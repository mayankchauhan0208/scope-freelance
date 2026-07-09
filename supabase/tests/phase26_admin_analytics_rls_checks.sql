-- Phase 26 admin analytics smoke checks.
-- Run after applying supabase/migrations/014_admin_analytics_growth.sql.

select 'analytics_events table exists' as check_name
where to_regclass('public.analytics_events') is not null;

select 'error_logs table exists' as check_name
where to_regclass('public.error_logs') is not null;

select 'source_health_logs table exists' as check_name
where to_regclass('public.source_health_logs') is not null;

select 'admin_notes table exists' as check_name
where to_regclass('public.admin_notes') is not null;

select 'all phase26 private tables have rls enabled' as check_name
where not exists (
  select 1
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'analytics_events','error_logs','source_health_logs','product_health_snapshots',
      'admin_notes','beta_invites','referral_events','feature_requests'
    )
    and c.relrowsecurity is not true
);

select 'admin dashboard rpc exists' as check_name
where to_regprocedure('public.admin_phase26_dashboard()') is not null;

select 'admin note rpc exists' as check_name
where to_regprocedure('public.admin_add_note(text,text,text)') is not null;

select 'anon cannot select admin notes' as check_name
where not has_table_privilege('anon', 'public.admin_notes', 'select');

select 'anon cannot select error logs' as check_name
where not has_table_privilege('anon', 'public.error_logs', 'select');

select 'authenticated cannot bypass admin dashboard without rpc check' as check_name
where has_function_privilege('authenticated', 'public.admin_phase26_dashboard()', 'execute');
