-- Phase 28 onboarding RLS checks.
-- Run after migration 016 is applied.

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('onboarding_progress','user_career_goals','user_preferences','onboarding_events','demo_mode_state');

select
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name in ('onboarding_progress','user_career_goals','user_preferences','onboarding_events','demo_mode_state');

select
  proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('upsert_onboarding_progress','record_onboarding_event','get_onboarding_status','admin_onboarding_dashboard')
order by proname;

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.onboarding_progress'::regclass,
  'public.onboarding_events'::regclass,
  'public.user_career_goals'::regclass
)
order by conname;
