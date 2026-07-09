-- Phase 28: guided onboarding, activation, and user success foundation.
-- Additive only. Does not rename existing tables or delete existing data.

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name in (
    'visitor_seen','signup_started','signup_completed','login','resume_uploaded','resume_parsed',
    'resume_analysis_completed','job_search_performed','job_saved','job_moved_pipeline',
    'application_kit_generated','resume_tailored','cover_letter_generated','email_draft_generated',
    'email_copied','email_marked_sent','followup_scheduled','job_marked_applied','job_outcome_updated',
    'feedback_submitted','error_encountered','source_health_checked','export_created',
    'upgrade_attempted','usage_limit_hit',
    'onboarding_started','profile_step_completed','resume_analyzed','career_target_set',
    'onboarding_source_preferences_saved','notification_preferences_saved','onboarding_skipped',
    'onboarding_completed','first_job_searched','first_job_saved','first_application_kit_generated',
    'first_application_marked_applied','first_followup_scheduled'
  ));

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step text,
  completed boolean not null default false,
  skipped boolean not null default false,
  activation_score integer not null default 0 check (activation_score between 0 and 100),
  checklist jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_career_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_role text,
  secondary_roles text[] not null default array[]::text[],
  preferred_locations text[] not null default array[]::text[],
  remote_preference text,
  experience_level text,
  expected_salary text,
  min_salary text,
  job_type text,
  industries text[] not null default array[]::text[],
  notice_period text,
  work_authorization text,
  portfolio_url text check (portfolio_url is null or portfolio_url ~* '^https?://'),
  preferred_application_method text,
  source_preference text,
  first_search_goal text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notification_preferences jsonb not null default '{}'::jsonb,
  demo_mode_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'onboarding_started','profile_step_completed','resume_analyzed','career_target_set',
    'onboarding_source_preferences_saved','notification_preferences_saved','onboarding_skipped',
    'onboarding_completed','first_job_searched','first_job_saved','first_application_kit_generated',
    'first_application_marked_applied','first_followup_scheduled'
  )),
  step text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_mode_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  replaced_with_real_resume_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_events_user_created_idx on public.onboarding_events (user_id, created_at desc);
create index if not exists onboarding_events_name_created_idx on public.onboarding_events (event_name, created_at desc);

drop trigger if exists trg_onboarding_progress_updated_at on public.onboarding_progress;
create trigger trg_onboarding_progress_updated_at
  before update on public.onboarding_progress
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_career_goals_updated_at on public.user_career_goals;
create trigger trg_user_career_goals_updated_at
  before update on public.user_career_goals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists trg_demo_mode_state_updated_at on public.demo_mode_state;
create trigger trg_demo_mode_state_updated_at
  before update on public.demo_mode_state
  for each row execute function public.set_updated_at();

alter table public.onboarding_progress enable row level security;
alter table public.user_career_goals enable row level security;
alter table public.user_preferences enable row level security;
alter table public.onboarding_events enable row level security;
alter table public.demo_mode_state enable row level security;

drop policy if exists onboarding_progress_owner_select on public.onboarding_progress;
create policy onboarding_progress_owner_select on public.onboarding_progress
  for select to authenticated using (user_id = auth.uid() or public.is_roledesk_admin(auth.uid()));
drop policy if exists onboarding_progress_owner_insert on public.onboarding_progress;
create policy onboarding_progress_owner_insert on public.onboarding_progress
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists onboarding_progress_owner_update on public.onboarding_progress;
create policy onboarding_progress_owner_update on public.onboarding_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_career_goals_owner_select on public.user_career_goals;
create policy user_career_goals_owner_select on public.user_career_goals
  for select to authenticated using (user_id = auth.uid() or public.is_roledesk_admin(auth.uid()));
drop policy if exists user_career_goals_owner_insert on public.user_career_goals;
create policy user_career_goals_owner_insert on public.user_career_goals
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_career_goals_owner_update on public.user_career_goals;
create policy user_career_goals_owner_update on public.user_career_goals
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_preferences_owner_select on public.user_preferences;
create policy user_preferences_owner_select on public.user_preferences
  for select to authenticated using (user_id = auth.uid() or public.is_roledesk_admin(auth.uid()));
drop policy if exists user_preferences_owner_insert on public.user_preferences;
create policy user_preferences_owner_insert on public.user_preferences
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_preferences_owner_update on public.user_preferences;
create policy user_preferences_owner_update on public.user_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists onboarding_events_owner_select on public.onboarding_events;
create policy onboarding_events_owner_select on public.onboarding_events
  for select to authenticated using (user_id = auth.uid() or public.is_roledesk_admin(auth.uid()));
drop policy if exists onboarding_events_owner_insert on public.onboarding_events;
create policy onboarding_events_owner_insert on public.onboarding_events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists demo_mode_state_owner_select on public.demo_mode_state;
create policy demo_mode_state_owner_select on public.demo_mode_state
  for select to authenticated using (user_id = auth.uid() or public.is_roledesk_admin(auth.uid()));
drop policy if exists demo_mode_state_owner_insert on public.demo_mode_state;
create policy demo_mode_state_owner_insert on public.demo_mode_state
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists demo_mode_state_owner_update on public.demo_mode_state;
create policy demo_mode_state_owner_update on public.demo_mode_state
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.onboarding_progress, public.user_career_goals, public.user_preferences, public.onboarding_events, public.demo_mode_state from anon, authenticated;
grant select, insert, update on public.onboarding_progress, public.user_career_goals, public.user_preferences, public.demo_mode_state to authenticated;
grant select, insert on public.onboarding_events to authenticated;

create or replace function public.roledesk_text_array(value text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_remove(array(select trim(x) from unnest(string_to_array(coalesce(value, ''), ',')) as x), ''), array[]::text[])
$$;

create or replace function public.upsert_onboarding_progress(
  p_step text,
  p_state jsonb default '{}'::jsonb,
  p_goals jsonb default '{}'::jsonb,
  p_preferences jsonb default '{}'::jsonb,
  p_activation_score integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_score integer := greatest(0, least(100, coalesce(p_activation_score, 0)));
  v_completed boolean := coalesce((p_state->>'completed')::boolean, false);
  v_skipped boolean := coalesce((p_state->>'skipped')::boolean, false);
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  insert into public.onboarding_progress (user_id, current_step, state, completed, skipped, activation_score, completed_at, updated_at)
  values (v_user, left(coalesce(p_step, 'welcome'), 80), coalesce(p_state, '{}'::jsonb), v_completed, v_skipped, v_score, case when v_completed then now() else null end, now())
  on conflict (user_id) do update set
    current_step = excluded.current_step,
    state = excluded.state,
    completed = excluded.completed,
    skipped = excluded.skipped,
    activation_score = excluded.activation_score,
    completed_at = case when excluded.completed then coalesce(public.onboarding_progress.completed_at, now()) else public.onboarding_progress.completed_at end,
    updated_at = now();

  insert into public.user_career_goals (
    user_id, primary_role, secondary_roles, preferred_locations, remote_preference, experience_level,
    expected_salary, min_salary, job_type, industries, notice_period, work_authorization, portfolio_url,
    preferred_application_method, source_preference, first_search_goal, updated_at
  )
  values (
    v_user,
    nullif(left(coalesce(p_goals->>'primaryRole', ''), 300), ''),
    public.roledesk_text_array(p_goals->>'secondaryRoles'),
    public.roledesk_text_array(p_goals->>'preferredLocations'),
    nullif(left(coalesce(p_goals->>'remotePreference', ''), 120), ''),
    nullif(left(coalesce(p_goals->>'experienceLevel', ''), 120), ''),
    nullif(left(coalesce(p_goals->>'expectedSalary', ''), 120), ''),
    nullif(left(coalesce(p_goals->>'minSalary', ''), 120), ''),
    nullif(left(coalesce(p_goals->>'jobType', ''), 120), ''),
    public.roledesk_text_array(p_goals->>'industries'),
    nullif(left(coalesce(p_goals->>'noticePeriod', ''), 120), ''),
    nullif(left(coalesce(p_goals->>'workAuthorization', ''), 200), ''),
    case when coalesce(p_goals->>'portfolioUrl', '') ~* '^https?://' then left(p_goals->>'portfolioUrl', 1000) else null end,
    nullif(left(coalesce(p_goals->>'preferredApplicationMethod', ''), 160), ''),
    nullif(left(coalesce(p_goals->>'sourcePreference', ''), 160), ''),
    nullif(left(coalesce(p_goals->>'firstSearchGoal', ''), 500), ''),
    now()
  )
  on conflict (user_id) do update set
    primary_role = excluded.primary_role,
    secondary_roles = excluded.secondary_roles,
    preferred_locations = excluded.preferred_locations,
    remote_preference = excluded.remote_preference,
    experience_level = excluded.experience_level,
    expected_salary = excluded.expected_salary,
    min_salary = excluded.min_salary,
    job_type = excluded.job_type,
    industries = excluded.industries,
    notice_period = excluded.notice_period,
    work_authorization = excluded.work_authorization,
    portfolio_url = excluded.portfolio_url,
    preferred_application_method = excluded.preferred_application_method,
    source_preference = excluded.source_preference,
    first_search_goal = excluded.first_search_goal,
    updated_at = now();

  insert into public.user_preferences (user_id, notification_preferences, demo_mode_enabled, updated_at)
  values (v_user, coalesce(p_preferences, '{}'::jsonb), coalesce((p_state->>'demoModeEnabled')::boolean, false), now())
  on conflict (user_id) do update set
    notification_preferences = excluded.notification_preferences,
    demo_mode_enabled = excluded.demo_mode_enabled,
    updated_at = now();

  return public.get_onboarding_status();
end;
$$;

create or replace function public.record_onboarding_event(
  p_event_name text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_step text := left(coalesce(p_metadata->>'step', p_metadata->>'source', ''), 80);
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  insert into public.onboarding_events (user_id, event_name, step, metadata)
  values (v_user, p_event_name, nullif(v_step, ''), coalesce(p_metadata, '{}'::jsonb));

  insert into public.analytics_events (user_id, event_name, page, metadata)
  values (v_user, p_event_name, 'onboarding', coalesce(p_metadata, '{}'::jsonb));

  return jsonb_build_object('ok', true, 'event_name', p_event_name);
end;
$$;

create or replace function public.get_onboarding_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'progress', coalesce((select to_jsonb(p) from public.onboarding_progress p where p.user_id = auth.uid()), '{}'::jsonb),
    'goals', coalesce((select to_jsonb(g) from public.user_career_goals g where g.user_id = auth.uid()), '{}'::jsonb),
    'preferences', coalesce((select to_jsonb(pref) from public.user_preferences pref where pref.user_id = auth.uid()), '{}'::jsonb),
    'recent_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select * from public.onboarding_events where user_id = auth.uid() order by created_at desc limit 20) e), '[]'::jsonb)
  )
$$;

create or replace function public.admin_onboarding_dashboard()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when not public.is_roledesk_admin(auth.uid()) then jsonb_build_object('error', 'admin_required')
    else jsonb_build_object(
      'started', (select count(*)::int from public.onboarding_progress),
      'completed', (select count(*)::int from public.onboarding_progress where completed),
      'skipped', (select count(*)::int from public.onboarding_progress where skipped),
      'average_activation', (select coalesce(round(avg(activation_score))::int, 0) from public.onboarding_progress),
      'events', coalesce((select jsonb_object_agg(event_name, count) from (select event_name, count(*)::int from public.onboarding_events group by event_name) e), '{}'::jsonb),
      'recent_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select event_name, created_at from public.onboarding_events order by created_at desc limit 50) e), '[]'::jsonb)
    )
  end
$$;

revoke all on function public.roledesk_text_array(text) from public;
revoke all on function public.upsert_onboarding_progress(text,jsonb,jsonb,jsonb,integer) from public;
revoke all on function public.record_onboarding_event(text,jsonb) from public;
revoke all on function public.get_onboarding_status() from public;
revoke all on function public.admin_onboarding_dashboard() from public;
grant execute on function public.upsert_onboarding_progress(text,jsonb,jsonb,jsonb,integer) to authenticated;
grant execute on function public.record_onboarding_event(text,jsonb) to authenticated;
grant execute on function public.get_onboarding_status() to authenticated;
grant execute on function public.admin_onboarding_dashboard() to authenticated;
