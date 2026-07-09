begin;

-- Phase 26 is additive: admin analytics, feedback operations, and growth foundations.
-- It does not rename or drop user data tables.

alter table public.feedback
  add column if not exists browser_info jsonb not null default '{}'::jsonb,
  add column if not exists device_info jsonb not null default '{}'::jsonb,
  add column if not exists screenshot_url text,
  add column if not exists admin_notes text,
  add column if not exists duplicate_of uuid references public.feedback(id) on delete set null;

alter table public.feedback drop constraint if exists feedback_type_check;
alter table public.feedback
  add constraint feedback_type_check
  check (feedback_type in (
    'Bug','Confusing UI','Bad job match','Resume issue','Draft issue','Feature request','Other',
    'Bug report','Job result issue','Email issue','Resume analysis issue','Wrong match score',
    'Bad recommendation','UI confusion','General feedback','Login issue','Application packet issue',
    'Tracker/follow-up issue','Mobile/UI issue'
  ));

alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback
  add constraint feedback_status_check
  check (status in ('new','reviewed','in_progress','fixed','rejected','duplicate','needs_more_info','planned','archived'));

alter table public.feedback drop constraint if exists feedback_screenshot_url_safe;
alter table public.feedback
  add constraint feedback_screenshot_url_safe
  check (screenshot_url is null or screenshot_url ~* '^https?://');

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (event_name in (
    'visitor_seen','signup_started','signup_completed','login',
    'resume_uploaded','resume_parsed','resume_analysis_completed',
    'job_search_performed','job_saved','job_moved_pipeline',
    'application_kit_generated','resume_tailored','cover_letter_generated',
    'email_draft_generated','email_copied','email_marked_sent',
    'followup_scheduled','job_marked_applied','job_outcome_updated',
    'feedback_submitted','error_encountered','source_health_checked','export_created'
  )),
  page text,
  entity_type text,
  entity_id text,
  severity text not null default 'info' check (severity in ('critical','error','warning','info')),
  message text,
  path text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  browser_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  error_type text,
  severity text not null default 'error' check (severity in ('critical','error','warning','info')),
  message text not null,
  page text,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  browser_info jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewed','fixed','ignored')),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null,
  source_id text,
  source_name text,
  status text not null default 'unknown',
  reliability_score integer not null default 0 check (reliability_score between 0 and 100),
  fetched integer not null default 0 check (fetched >= 0),
  jobs_fetched integer not null default 0 check (jobs_fetched >= 0),
  duplicates integer not null default 0 check (duplicates >= 0),
  duplicate_jobs integer not null default 0 check (duplicate_jobs >= 0),
  failed_requests integer not null default 0 check (failed_requests >= 0),
  last_error text,
  error_message text,
  trust_average numeric,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.product_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  user_email citext,
  tag text,
  note text not null check (char_length(note) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  invite_code text unique not null default encode(gen_random_bytes(12), 'hex'),
  referred_by uuid references auth.users(id) on delete set null,
  status text not null default 'created' check (status in ('created','sent','accepted','revoked','expired')),
  note text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  referral_code text,
  referred_email citext,
  event_name text not null check (event_name in ('invite_created','invite_shared','signup_referred','invite_accepted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  title text not null,
  description text,
  status text not null default 'new' check (status in ('new','reviewed','planned','shipped','rejected','archived')),
  votes integer not null default 0 check (votes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analytics_events_user_created_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_name_created_idx on public.analytics_events (event_name, created_at desc);
create index if not exists error_logs_status_created_idx on public.error_logs (status, created_at desc);
create index if not exists source_health_source_created_idx on public.source_health_logs (source, created_at desc);
create index if not exists admin_notes_user_created_idx on public.admin_notes (user_email, created_at desc);
create index if not exists referral_events_user_created_idx on public.referral_events (user_id, created_at desc);
create index if not exists feature_requests_user_created_idx on public.feature_requests (user_id, created_at desc);

alter table public.analytics_events enable row level security;
alter table public.error_logs enable row level security;
alter table public.source_health_logs enable row level security;
alter table public.product_health_snapshots enable row level security;
alter table public.admin_notes enable row level security;
alter table public.beta_invites enable row level security;
alter table public.referral_events enable row level security;
alter table public.feature_requests enable row level security;

drop policy if exists analytics_events_client_insert on public.analytics_events;
create policy analytics_events_client_insert on public.analytics_events
for insert to anon, authenticated
with check ((auth.uid() is null and user_id is null) or (auth.uid() = user_id));

drop policy if exists analytics_events_owner_select on public.analytics_events;
create policy analytics_events_owner_select on public.analytics_events
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists error_logs_client_insert on public.error_logs;
create policy error_logs_client_insert on public.error_logs
for insert to anon, authenticated
with check ((auth.uid() is null and user_id is null) or (auth.uid() = user_id));

drop policy if exists error_logs_owner_select on public.error_logs;
create policy error_logs_owner_select on public.error_logs
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists error_logs_admin_update on public.error_logs;
create policy error_logs_admin_update on public.error_logs
for update to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

drop policy if exists source_health_client_insert on public.source_health_logs;
create policy source_health_client_insert on public.source_health_logs
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists source_health_owner_admin_select on public.source_health_logs;
create policy source_health_owner_admin_select on public.source_health_logs
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists product_health_admin_all on public.product_health_snapshots;
create policy product_health_admin_all on public.product_health_snapshots
for all to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

drop policy if exists admin_notes_admin_all on public.admin_notes;
create policy admin_notes_admin_all on public.admin_notes
for all to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

drop policy if exists beta_invites_admin_all on public.beta_invites;
create policy beta_invites_admin_all on public.beta_invites
for all to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

drop policy if exists referral_events_client_insert on public.referral_events;
create policy referral_events_client_insert on public.referral_events
for insert to anon, authenticated
with check ((auth.uid() is null and user_id is null) or (auth.uid() = user_id));

drop policy if exists referral_events_owner_select on public.referral_events;
create policy referral_events_owner_select on public.referral_events
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists feature_requests_client_insert on public.feature_requests;
create policy feature_requests_client_insert on public.feature_requests
for insert to anon, authenticated
with check ((auth.uid() is null and user_id is null) or (auth.uid() = user_id));

drop policy if exists feature_requests_owner_select on public.feature_requests;
create policy feature_requests_owner_select on public.feature_requests
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists feature_requests_admin_update on public.feature_requests;
create policy feature_requests_admin_update on public.feature_requests
for update to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

revoke all on public.analytics_events, public.error_logs, public.source_health_logs, public.product_health_snapshots, public.admin_notes, public.beta_invites, public.referral_events, public.feature_requests from anon, authenticated;
grant insert on public.analytics_events, public.error_logs, public.referral_events, public.feature_requests to anon, authenticated;
grant select on public.analytics_events, public.error_logs, public.referral_events, public.feature_requests to authenticated;
grant insert, select on public.source_health_logs to authenticated;
grant select, insert, update on public.error_logs, public.feature_requests to authenticated;
grant select, insert, update, delete on public.product_health_snapshots, public.admin_notes, public.beta_invites to authenticated;

create or replace function public.admin_update_feedback_status(
  p_feedback_id uuid,
  p_status text
)
returns public.feedback
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.feedback;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if p_status not in ('new','reviewed','in_progress','fixed','rejected','duplicate','needs_more_info','planned','archived') then
    raise exception 'Invalid feedback status.' using errcode = '22023';
  end if;
  update public.feedback
  set status = p_status
  where id = p_feedback_id
  returning * into result;
  if result.id is null then
    raise exception 'Feedback not found.' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.admin_add_note(
  p_email text,
  p_tag text,
  p_note text
)
returns public.admin_notes
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.admin_notes;
  target auth.users;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_note, '')) < 1 or char_length(p_note) > 1000 then
    raise exception 'Note must be 1-1000 characters.' using errcode = '22023';
  end if;
  if p_email is not null then
    select * into target from auth.users where lower(email) = lower(p_email) limit 1;
  end if;
  insert into public.admin_notes (admin_user_id, target_user_id, user_email, tag, note)
  values (auth.uid(), target.id, nullif(lower(p_email), '')::citext, nullif(left(coalesce(p_tag, ''), 80), ''), left(p_note, 1000))
  returning * into result;
  return result;
end;
$$;

create or replace function public.admin_update_error_status(
  p_error_id uuid,
  p_status text,
  p_resolution_note text default null
)
returns public.error_logs
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.error_logs;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if p_status not in ('open','reviewed','fixed','ignored') then
    raise exception 'Invalid error status.' using errcode = '22023';
  end if;
  update public.error_logs
  set status = p_status,
      resolution_note = left(coalesce(p_resolution_note, resolution_note, ''), 1000),
      updated_at = now()
  where id = p_error_id
  returning * into result;
  if result.id is null then
    raise exception 'Error log not found.' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.admin_phase26_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  payload jsonb;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  with event_counts as (
    select event_name, count(*)::int as count
    from public.analytics_events
    where created_at >= now() - interval '30 days'
    group by event_name
  ),
  metrics as (
    select jsonb_build_object(
      'users', (select count(*)::int from auth.users),
      'new_users_7d', (select count(*)::int from auth.users where created_at >= now() - interval '7 days'),
      'active_users_7d', (select count(distinct user_id)::int from public.analytics_events where user_id is not null and created_at >= now() - interval '7 days'),
      'visitors', coalesce((select count from event_counts where event_name = 'visitor_seen'), 0),
      'signups', coalesce((select count from event_counts where event_name = 'signup_completed'), 0),
      'resume_uploads', coalesce((select count from event_counts where event_name = 'resume_uploaded'), 0),
      'jobs_searched', coalesce((select count from event_counts where event_name = 'job_search_performed'), 0),
      'jobs_saved', coalesce((select count from event_counts where event_name = 'job_saved'), 0),
      'application_kits', coalesce((select count from event_counts where event_name = 'application_kit_generated'), 0),
      'emails_drafted', coalesce((select count from event_counts where event_name = 'email_draft_generated'), 0),
      'emails_copied', coalesce((select count from event_counts where event_name = 'email_copied'), 0),
      'emails_marked_sent', coalesce((select count from event_counts where event_name = 'email_marked_sent'), 0),
      'followups', coalesce((select count from event_counts where event_name = 'followup_scheduled'), 0),
      'applied', coalesce((select count from event_counts where event_name = 'job_marked_applied'), 0),
      'outcomes', coalesce((select count from event_counts where event_name = 'job_outcome_updated'), 0),
      'feedback', (select count(*)::int from public.feedback),
      'errors', (select count(*)::int from public.error_logs where created_at >= now() - interval '30 days'),
      'open_errors', (select count(*)::int from public.error_logs where status = 'open'),
      'last_event_at', (select max(created_at) from public.analytics_events),
      'funnel', coalesce((select jsonb_object_agg(event_name, count) from event_counts), '{}'::jsonb),
      'success', coalesce((select jsonb_object_agg(event_name, count) from event_counts where event_name in ('job_search_performed','job_saved','application_kit_generated','email_copied','email_marked_sent','job_marked_applied','followup_scheduled','job_outcome_updated')), '{}'::jsonb)
    ) as data
  ),
  user_rows as (
    select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc) as data
    from (
      select
        u.id,
        u.email,
        coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as display_name,
        u.created_at,
        (select max(created_at) from public.analytics_events ae where ae.user_id = u.id) as last_active_at,
        exists (select 1 from public.analytics_events ae where ae.user_id = u.id and ae.event_name in ('resume_uploaded','resume_parsed','resume_analysis_completed')) as resume_uploaded,
        (select count(*)::int from public.analytics_events ae where ae.user_id = u.id and ae.event_name = 'job_search_performed') as jobs_searched,
        (select count(*)::int from public.analytics_events ae where ae.user_id = u.id and ae.event_name = 'job_saved') as jobs_saved,
        (select count(*)::int from public.analytics_events ae where ae.user_id = u.id and ae.event_name = 'application_kit_generated') as application_kits,
        coalesce(ba.active, false) as beta_active,
        case when ba.email is not null then 'allowlisted' else 'public' end as beta_status
      from auth.users u
      left join public.beta_access ba on lower(ba.email::text) = lower(u.email)
      order by u.created_at desc
      limit 100
    ) row_data
  ),
  latest_source as (
    select distinct on (source)
      source, source_name, status, reliability_score, fetched, duplicates, failed_requests, last_error, checked_at, created_at
    from public.source_health_logs
    order by source, checked_at desc
  )
  select jsonb_build_object(
    'metrics', (select data from metrics),
    'users', coalesce((select data from user_rows), '[]'::jsonb),
    'beta_users', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (select email, active, note, expires_at, created_at from public.beta_access order by created_at desc limit 250) b), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc) from (select id, email, feedback_type, page, message, status, created_at, browser_info, device_info from public.feedback order by created_at desc limit 250) f), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id, user_id, severity, message, page, path, status, resolution_note, created_at from public.error_logs order by created_at desc limit 100) e), '[]'::jsonb),
    'source_health', coalesce((select jsonb_agg(to_jsonb(s) order by s.checked_at desc) from latest_source s), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select id, user_email, tag, note, created_at from public.admin_notes order by created_at desc limit 100) n), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.admin_update_feedback_status(uuid, text) from public, anon;
revoke all on function public.admin_add_note(text, text, text) from public, anon;
revoke all on function public.admin_update_error_status(uuid, text, text) from public, anon;
revoke all on function public.admin_phase26_dashboard() from public, anon;
grant execute on function public.admin_update_feedback_status(uuid, text) to authenticated;
grant execute on function public.admin_add_note(text, text, text) to authenticated;
grant execute on function public.admin_update_error_status(uuid, text, text) to authenticated;
grant execute on function public.admin_phase26_dashboard() to authenticated;

commit;
