-- Phase 27 billing and usage smoke checks.
-- Run after applying supabase/migrations/015_billing_plans_usage.sql.

select 'billing tables exist' as check_name
where to_regclass('public.plan_catalog') is not null
  and to_regclass('public.user_subscriptions') is not null
  and to_regclass('public.usage_counters') is not null
  and to_regclass('public.checkout_sessions') is not null
  and to_regclass('public.payment_webhook_events') is not null
  and to_regclass('public.plan_change_logs') is not null;

select 'billing tables have rls enabled' as check_name
where not exists (
  select 1
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('plan_catalog','user_subscriptions','usage_counters','checkout_sessions','payment_webhook_events','plan_change_logs')
    and c.relrowsecurity is not true
);

select 'billing rpcs exist' as check_name
where to_regprocedure('public.get_billing_status()') is not null
  and to_regprocedure('public.record_usage_event(text,integer)') is not null
  and to_regprocedure('public.create_checkout_placeholder(text)') is not null
  and to_regprocedure('public.admin_assign_user_plan(text,text,text,integer,text)') is not null
  and to_regprocedure('public.process_payment_webhook(text,text,text,boolean,jsonb)') is not null;

select 'anon cannot read private billing tables' as check_name
where not has_table_privilege('anon', 'public.user_subscriptions', 'select')
  and not has_table_privilege('anon', 'public.usage_counters', 'select')
  and not has_table_privilege('anon', 'public.payment_webhook_events', 'select');

select 'webhook processing is not browser callable' as check_name
where not has_function_privilege('authenticated', 'public.process_payment_webhook(text,text,text,boolean,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.process_payment_webhook(text,text,text,boolean,jsonb)', 'execute');
