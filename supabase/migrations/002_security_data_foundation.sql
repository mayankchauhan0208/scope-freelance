begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Beta access is enforced at the database boundary, not by frontend email checks.
create table if not exists public.beta_access (
  email citext primary key,
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  note text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beta_access enable row level security;
revoke all on public.beta_access from anon, authenticated;

-- Existing users retain access when beta enforcement is enabled.
insert into public.beta_access (email, note)
select email, 'Backfilled existing account'
from auth.users
where email is not null
on conflict (email) do nothing;

create or replace function public.enforce_beta_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.email is null or not exists (
    select 1
    from public.beta_access b
    where b.email = new.email
      and b.active = true
      and (b.expires_at is null or b.expires_at > now())
  ) then
    raise exception 'Beta access required for this email.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_beta_access_before_signup on auth.users;
create trigger enforce_beta_access_before_signup
before insert on auth.users
for each row execute function public.enforce_beta_access();

revoke all on function public.enforce_beta_access() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  mime_type text,
  storage_path text,
  extracted_text text,
  status text not null default 'uploaded'
    check (status in ('uploaded','extracting','needs_review','reviewed','failed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunities
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from public.opportunities
    where status not in (
      'discovered','analyzed','shortlisted','saved','proposal_drafted',
      'proposal_sent','client_replied','negotiation','hired','in_progress',
      'submitted','revision_requested','completed','payment_received',
      'client_lost','skipped','archived'
    )
  ) then
    raise exception 'Status preflight failed: opportunities contain unsupported status values.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_status_allowed'
  ) then
    alter table public.opportunities
      add constraint opportunities_status_allowed check (
        status in (
          'discovered','analyzed','shortlisted','saved','proposal_drafted',
          'proposal_sent','client_replied','negotiation','hired','in_progress',
          'submitted','revision_requested','completed','payment_received',
          'client_lost','skipped','archived'
        )
      ) not valid;
  end if;
end $$;

alter table public.drafts
  add column if not exists recipient text,
  add column if not exists subject text,
  add column if not exists body text,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_version integer not null default 0;

create unique index if not exists opportunities_id_user_id_uidx
  on public.opportunities (id, user_id);
create unique index if not exists resumes_id_user_id_uidx
  on public.resumes (id, user_id);
create unique index if not exists drafts_id_user_id_uidx
  on public.drafts (id, user_id);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid,
  resume_id uuid,
  draft_id uuid,
  status text not null default 'preparing'
    check (status in ('preparing','ready_for_review','approved','submitted','replied','interviewing','offered','hired','rejected','withdrawn','archived')),
  application_url text check (application_url is null or application_url ~* '^https?://'),
  form_data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.applications
  add column if not exists resume_id uuid;

-- Stop before adding ownership constraints if legacy rows cross user boundaries.
do $$
begin
  if exists (
    select 1
    from public.drafts d
    where d.opportunity_id is not null
      and not exists (
        select 1 from public.opportunities o
        where o.id = d.opportunity_id and o.user_id = d.user_id
      )
  ) then
    raise exception 'Ownership preflight failed: drafts reference opportunities owned by another user.';
  end if;

  if exists (
    select 1
    from public.applications a
    where a.opportunity_id is not null
      and not exists (
        select 1 from public.opportunities o
        where o.id = a.opportunity_id and o.user_id = a.user_id
      )
  ) then
    raise exception 'Ownership preflight failed: applications reference opportunities owned by another user.';
  end if;

  if exists (
    select 1
    from public.applications a
    where a.resume_id is not null
      and not exists (
        select 1 from public.resumes r
        where r.id = a.resume_id and r.user_id = a.user_id
      )
  ) then
    raise exception 'Ownership preflight failed: applications reference resumes owned by another user.';
  end if;

  if exists (
    select 1
    from public.applications a
    where a.draft_id is not null
      and not exists (
        select 1 from public.drafts d
        where d.id = a.draft_id and d.user_id = a.user_id
      )
  ) then
    raise exception 'Ownership preflight failed: applications reference drafts owned by another user.';
  end if;

  if exists (
    select 1
    from public.audit_log l
    where l.opportunity_id is not null
      and not exists (
        select 1 from public.opportunities o
        where o.id = l.opportunity_id and o.user_id = l.user_id
      )
  ) or exists (
    select 1
    from public.audit_log l
    where l.draft_id is not null
      and not exists (
        select 1 from public.drafts d
        where d.id = l.draft_id and d.user_id = l.user_id
      )
  ) then
    raise exception 'Ownership preflight failed: legacy audit rows cross user boundaries.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.drafts'::regclass
      and conname = 'drafts_opportunity_owner_fk'
  ) then
    alter table public.drafts
      add constraint drafts_opportunity_owner_fk
      foreign key (opportunity_id, user_id)
      references public.opportunities (id, user_id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.drafts'::regclass
      and conname = 'drafts_approved_by_owner_check'
  ) then
    alter table public.drafts
      add constraint drafts_approved_by_owner_check
      check (approved_by is null or approved_by = user_id)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_opportunity_owner_fk'
  ) then
    alter table public.applications
      add constraint applications_opportunity_owner_fk
      foreign key (opportunity_id, user_id)
      references public.opportunities (id, user_id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_resume_owner_fk'
  ) then
    alter table public.applications
      add constraint applications_resume_owner_fk
      foreign key (resume_id, user_id)
      references public.resumes (id, user_id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_draft_owner_fk'
  ) then
    alter table public.applications
      add constraint applications_draft_owner_fk
      foreign key (draft_id, user_id)
      references public.drafts (id, user_id)
      on delete restrict
      not valid;
  end if;
end $$;

alter table public.opportunities validate constraint opportunities_status_allowed;
alter table public.drafts validate constraint drafts_opportunity_owner_fk;
alter table public.drafts validate constraint drafts_approved_by_owner_check;
alter table public.applications validate constraint applications_opportunity_owner_fk;
alter table public.applications validate constraint applications_resume_owner_fk;
alter table public.applications validate constraint applications_draft_owner_fk;

create table if not exists public.portal_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  external_account_id text,
  status text not null default 'pending'
    check (status in ('pending','connected','expired','revoked','error')),
  scopes text[] not null default '{}',
  secret_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

comment on column public.portal_connections.secret_reference is
  'Backend secret-manager reference only. Never store an OAuth token or client secret in this browser-readable row.';

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Standard updated_at behavior.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['beta_access','profiles','resumes','opportunities','drafts','applications','portal_connections']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

create or replace function public.guard_draft_approval()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.approval_state = 'draft_ready';
    new.approved_at = null;
    new.approved_by = null;
    new.content_hash = null;
    new.approval_version = 0;
    return new;
  end if;

  if not (
    new.recipient is distinct from old.recipient
    or new.subject is distinct from old.subject
    or new.body is distinct from old.body
    or new.opportunity_id is distinct from old.opportunity_id
    or new.destination is distinct from old.destination
    or new.content is distinct from old.content
  ) and (
    new.approval_state is distinct from old.approval_state
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or new.content_hash is distinct from old.content_hash
    or new.approval_version is distinct from old.approval_version
  ) and coalesce(current_setting('scope.approval_rpc', true), 'false') <> 'true' then
    raise exception 'Approval fields may only be changed through the approval RPCs.' using errcode = '42501';
  end if;

  if new.recipient is distinct from old.recipient
     or new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.opportunity_id is distinct from old.opportunity_id
     or new.destination is distinct from old.destination
     or new.content is distinct from old.content then
    new.approval_state = 'revoked';
    new.approved_at = null;
    new.approved_by = null;
    new.content_hash = null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_draft_approval_changes on public.drafts;
create trigger guard_draft_approval_changes
before insert or update on public.drafts
for each row execute function public.guard_draft_approval();

-- Replace broad policies with explicit per-operation owner policies.
drop policy if exists "profile owner access" on public.profiles;
drop policy if exists "opportunity owner access" on public.opportunities;
drop policy if exists "draft owner access" on public.drafts;
drop policy if exists "audit owner read" on public.audit_log;

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.opportunities enable row level security;
alter table public.drafts enable row level security;
alter table public.applications enable row level security;
alter table public.portal_connections enable row level security;
alter table public.activity_logs enable row level security;
alter table public.audit_log enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','resumes','opportunities','drafts','applications']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', table_name || '_owner_select', table_name);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', table_name || '_owner_insert', table_name);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name || '_owner_update', table_name);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', table_name || '_owner_delete', table_name);
  end loop;
end $$;

drop policy if exists portal_connections_owner_select on public.portal_connections;
create policy portal_connections_owner_select
on public.portal_connections for select
using (auth.uid() = user_id);

drop policy if exists activity_logs_owner_select on public.activity_logs;
create policy activity_logs_owner_select
on public.activity_logs for select
using (auth.uid() = user_id);

drop policy if exists audit_log_owner_select on public.audit_log;
create policy audit_log_owner_select
on public.audit_log for select
using (auth.uid() = user_id);

-- Explicit grants. Anonymous users receive no application-table access.
revoke all on public.profiles, public.resumes, public.opportunities, public.drafts,
  public.applications, public.portal_connections, public.activity_logs, public.audit_log
  from anon;

grant select, insert, update, delete on public.profiles, public.resumes, public.opportunities, public.applications
  to authenticated;
grant select, insert, delete on public.drafts to authenticated;
revoke update on public.drafts from authenticated;
grant update (opportunity_id, kind, destination, content, recipient, subject, body) on public.drafts to authenticated;
grant select (id, user_id, provider, external_account_id, status, scopes, metadata, created_at, updated_at)
  on public.portal_connections to authenticated;
grant select on public.activity_logs, public.audit_log to authenticated;
revoke insert, update, delete on public.portal_connections, public.activity_logs, public.audit_log from authenticated;

-- Remove any earlier generic logger that could forge authoritative events.
drop function if exists public.create_activity_log(text, text, uuid, jsonb);

create or replace function public.approve_draft(p_draft_id uuid)
returns public.drafts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  approved public.drafts;
begin
  if actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  perform set_config('scope.approval_rpc', 'true', true);
  update public.drafts d
  set approval_state = 'user_approved',
      approved_at = now(),
      approved_by = actor,
      approval_version = d.approval_version + 1,
      content_hash = encode(extensions.digest(
        coalesce(d.recipient, '') || chr(31) ||
        coalesce(d.subject, '') || chr(31) ||
        coalesce(d.body, '') || chr(31) ||
        coalesce(d.opportunity_id::text, '') || chr(31) ||
        coalesce(d.destination::text, '{}') || chr(31) ||
        coalesce(d.content::text, '{}'),
        'sha256'
      ), 'hex')
  where d.id = p_draft_id and d.user_id = actor
  returning d.* into approved;

  if approved.id is null then
    raise exception 'Draft not found or not owned by the current user.' using errcode = '42501';
  end if;

  insert into public.activity_logs (user_id, event_type, entity_type, entity_id, metadata)
  values (actor, 'draft.approved', 'draft', approved.id,
    jsonb_build_object('approval_version', approved.approval_version, 'content_hash', approved.content_hash));
  perform set_config('scope.approval_rpc', 'false', true);
  return approved;
end;
$$;

create or replace function public.revoke_draft_approval(p_draft_id uuid, p_reason text default 'user_revoked')
returns public.drafts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  revoked public.drafts;
begin
  if actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  perform set_config('scope.approval_rpc', 'true', true);
  update public.drafts d
  set approval_state = 'revoked', approved_at = null, approved_by = null, content_hash = null
  where d.id = p_draft_id and d.user_id = actor
  returning d.* into revoked;

  if revoked.id is null then
    raise exception 'Draft not found or not owned by the current user.' using errcode = '42501';
  end if;

  insert into public.activity_logs (user_id, event_type, entity_type, entity_id, metadata)
  values (actor, 'draft.approval_revoked', 'draft', revoked.id,
    jsonb_build_object('reason', coalesce(p_reason, 'user_revoked')));
  perform set_config('scope.approval_rpc', 'false', true);
  return revoked;
end;
$$;

revoke all on function public.approve_draft(uuid) from public, anon;
revoke all on function public.revoke_draft_approval(uuid, text) from public, anon;
grant execute on function public.approve_draft(uuid) to authenticated;
grant execute on function public.revoke_draft_approval(uuid, text) to authenticated;

commit;
