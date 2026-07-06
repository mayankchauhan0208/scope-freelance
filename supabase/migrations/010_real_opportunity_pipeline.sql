begin;

-- Extend the existing opportunity record; preserve every previous status for compatibility.
alter table public.opportunities
  add column if not exists quality_score integer check (quality_score is null or quality_score between 0 and 100),
  add column if not exists readiness_score integer check (readiness_score is null or readiness_score between 0 and 100),
  add column if not exists work_mode text check (work_mode is null or work_mode in ('remote','hybrid','onsite','unknown')),
  add column if not exists experience_level text,
  add column if not exists salary_text text,
  add column if not exists application_method text,
  add column if not exists application_deadline date,
  add column if not exists contact_name text,
  add column if not exists contact_email_verified boolean not null default false,
  add column if not exists contact_source_url text check (contact_source_url is null or contact_source_url ~* '^https?://'),
  add column if not exists contact_confidence text,
  add column if not exists contact_last_checked_at timestamptz;

do $$
begin
  if exists (
    select 1 from public.opportunities where status not in (
      'discovered','recommended','shortlisted','resume_ready','cover_letter_ready','applied',
      'follow_up_needed','interview_scheduled','offer','rejected','closed_not_relevant',
      'analyzed','saved','draft_prepared','ready_to_apply','proposal_drafted','proposal_sent',
      'email_sent','client_replied','interview','negotiation','hired','no_response','in_progress',
      'submitted','revision_requested','completed','payment_received','client_lost','skipped','archived'
    )
  ) then
    raise exception 'Phase 22 status preflight failed: unsupported opportunity status exists.';
  end if;
  alter table public.opportunities drop constraint if exists opportunities_status_allowed;
  alter table public.opportunities add constraint opportunities_status_allowed check (status in (
    'discovered','recommended','shortlisted','resume_ready','cover_letter_ready','applied',
    'follow_up_needed','interview_scheduled','offer','rejected','closed_not_relevant',
    'analyzed','saved','draft_prepared','ready_to_apply','proposal_drafted','proposal_sent',
    'email_sent','client_replied','interview','negotiation','hired','no_response','in_progress',
    'submitted','revision_requested','completed','payment_received','client_lost','skipped','archived'
  ));
end $$;

alter table public.applications
  add column if not exists application_method text,
  add column if not exists followup_at timestamptz,
  add column if not exists notes text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1 from public.applications
    where opportunity_id is not null
    group by user_id, opportunity_id having count(*) > 1
  ) then
    raise exception 'Phase 22 application preflight failed: duplicate user/opportunity application rows require review.';
  end if;
end $$;

create unique index if not exists applications_user_opportunity_uidx
  on public.applications(user_id, opportunity_id)
  where opportunity_id is not null;

create table if not exists public.opportunity_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null,
  contact_type text not null default 'recruiter'
    check (contact_type in ('recruiter','hr','hiring_manager','careers','referral','other')),
  contact_name text,
  verified_email text,
  possible_email text,
  email_verified boolean not null default false,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  linkedin_url text check (linkedin_url is null or linkedin_url ~* '^https?://'),
  confidence text not null default 'unverified'
    check (confidence in ('verified','public_source','unverified','possible_pattern')),
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_contacts_owner_fk foreign key (opportunity_id, user_id)
    references public.opportunities(id, user_id) on delete cascade
);

create table if not exists public.email_delivery_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid,
  draft_id uuid,
  email_type text not null,
  recipient text,
  status text not null check (status in ('pending','sent','failed','delivered','bounced','complained')),
  provider text,
  provider_message_id text,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_delivery_opportunity_owner_fk foreign key (opportunity_id, user_id)
    references public.opportunities(id, user_id) on delete cascade,
  constraint email_delivery_draft_owner_fk foreign key (draft_id, user_id)
    references public.drafts(id, user_id) on delete cascade
);

create unique index if not exists opportunity_contacts_owner_type_uidx
  on public.opportunity_contacts(user_id, opportunity_id, contact_type);

alter table public.opportunity_contacts enable row level security;
alter table public.email_delivery_logs enable row level security;

drop policy if exists opportunity_contacts_owner_select on public.opportunity_contacts;
drop policy if exists opportunity_contacts_owner_insert on public.opportunity_contacts;
drop policy if exists opportunity_contacts_owner_update on public.opportunity_contacts;
drop policy if exists opportunity_contacts_owner_delete on public.opportunity_contacts;
drop policy if exists email_delivery_logs_owner_select on public.email_delivery_logs;
create policy opportunity_contacts_owner_select on public.opportunity_contacts for select using (auth.uid() = user_id);
create policy opportunity_contacts_owner_insert on public.opportunity_contacts for insert with check (auth.uid() = user_id);
create policy opportunity_contacts_owner_update on public.opportunity_contacts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy opportunity_contacts_owner_delete on public.opportunity_contacts for delete using (auth.uid() = user_id);
create policy email_delivery_logs_owner_select on public.email_delivery_logs for select using (auth.uid() = user_id);

revoke all on public.opportunity_contacts, public.email_delivery_logs from anon;
grant select, insert, update, delete on public.opportunity_contacts to authenticated;
grant select on public.email_delivery_logs to authenticated;
revoke insert, update, delete on public.email_delivery_logs from authenticated;

drop trigger if exists set_opportunity_contacts_updated_at on public.opportunity_contacts;
create trigger set_opportunity_contacts_updated_at before update on public.opportunity_contacts
for each row execute function public.set_updated_at();

create or replace function public.mark_application_applied(
  p_source_url text,
  p_application_method text default null,
  p_followup_at date default null,
  p_notes text default null
)
returns public.applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  opportunity_row public.opportunities;
  application_row public.applications;
begin
  if actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_application_method is not null and p_application_method not in ('Company website','LinkedIn','Email','Referral','Recruiter','Job board','Other') then
    raise exception 'Unsupported application method.' using errcode = '22023';
  end if;
  if length(coalesce(p_notes,'')) > 5000 then raise exception 'Application notes are too long.' using errcode = '22023'; end if;

  select * into opportunity_row from public.opportunities
  where user_id = actor and source_url = p_source_url limit 1;
  if opportunity_row.id is null then raise exception 'Owned opportunity not found.' using errcode = '42501'; end if;

  update public.opportunities set
    status = 'applied',
    application_method = p_application_method,
    next_followup_at = case when p_followup_at is null then next_followup_at else p_followup_at::timestamptz end,
    followup_status = case when p_followup_at is null then followup_status else 'scheduled' end,
    followup_reason = case when p_followup_at is null then followup_reason else 'Check application status' end,
    updated_at = now()
  where id = opportunity_row.id and user_id = actor;

  insert into public.applications (user_id, opportunity_id, status, application_url, application_method, followup_at, notes, submitted_at, metadata)
  values (actor, opportunity_row.id, 'submitted', case when opportunity_row.source_url ~* '^https?://' then opportunity_row.source_url else null end, p_application_method,
    p_followup_at::timestamptz, p_notes, now(), jsonb_build_object('verification','user_reported','provider_confirmed',false))
  on conflict (user_id, opportunity_id) where opportunity_id is not null do update set
    status = 'submitted', application_method = excluded.application_method, followup_at = excluded.followup_at,
    notes = excluded.notes, submitted_at = excluded.submitted_at, metadata = excluded.metadata, updated_at = now()
  returning * into application_row;

  insert into public.activity_logs (user_id,event_type,entity_type,entity_id,metadata)
  values (actor,'application.marked_applied','application',application_row.id,
    jsonb_build_object('verification','user_reported','provider_confirmed',false,'method',p_application_method,'followup_at',p_followup_at));
  return application_row;
end;
$$;

revoke all on function public.mark_application_applied(text,text,date,text) from public, anon;
grant execute on function public.mark_application_applied(text,text,date,text) to authenticated;

-- Expand the client event allowlist without making provider delivery claims.
create or replace function public.record_tracker_client_event(
  p_source_url text,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.activity_logs
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare actor uuid := auth.uid(); opportunity_row public.opportunities; inserted public.activity_logs;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_event_type not in (
    'tracker.status_changed','tracker.followup_scheduled','tracker.followup_completed','tracker.followup_snoozed',
    'tracker.note_added','tracker.communication_updated','tracker.application_details_updated','application.marked_applied',
    'email.marked_sent','email.reply_marked','email.followup_scheduled'
  ) then raise exception 'Unsupported client tracker event.'; end if;
  if octet_length(coalesce(p_metadata,'{}'::jsonb)::text) > 16000 then raise exception 'Tracker event metadata is too large.'; end if;
  select * into opportunity_row from public.opportunities where user_id = actor and source_url = p_source_url limit 1;
  if opportunity_row.id is null then raise exception 'Owned opportunity not found.'; end if;
  insert into public.activity_logs (user_id,event_type,entity_type,entity_id,metadata)
  values (actor,p_event_type,'opportunity',opportunity_row.id,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('verification','user_reported','provider_confirmed',false))
  returning * into inserted;
  return inserted;
end;
$$;

revoke all on function public.record_tracker_client_event(text,text,jsonb) from public, anon;
grant execute on function public.record_tracker_client_event(text,text,jsonb) to authenticated;

commit;
