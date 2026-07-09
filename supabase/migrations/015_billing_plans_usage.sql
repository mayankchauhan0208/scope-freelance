begin;

-- Phase 27: SaaS monetization foundation.
-- Additive only: no table drops, data deletion, or table renames.

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name in (
    'visitor_seen','signup_started','signup_completed','login',
    'resume_uploaded','resume_parsed','resume_analysis_completed',
    'job_search_performed','job_saved','job_moved_pipeline',
    'application_kit_generated','resume_tailored','cover_letter_generated',
    'email_draft_generated','email_copied','email_marked_sent',
    'followup_scheduled','job_marked_applied','job_outcome_updated',
    'feedback_submitted','error_encountered','source_health_checked','export_created',
    'upgrade_attempted','usage_limit_hit'
  ));

create table if not exists public.plan_catalog (
  plan_id text primary key check (plan_id in ('free','beta','pro','premium','admin','custom')),
  name text not null,
  monthly_price_inr integer check (monthly_price_inr is null or monthly_price_inr >= 0),
  yearly_price_inr integer check (yearly_price_inr is null or yearly_price_inr >= 0),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  visible boolean not null default true,
  recommended boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plan_catalog (plan_id, name, monthly_price_inr, yearly_price_inr, limits, features, visible, recommended, active)
values
  ('free','Free',0,0,'{"resume_uploads":2,"resume_analyses":5,"job_searches":10,"saved_jobs":20,"application_kits":2,"resume_variants":2,"cover_letters":3,"recruiter_emails":5,"linkedin_messages":3,"freelance_proposals":3,"exports":3,"followup_reminders":5,"job_refreshes":5,"ai_recommendations":10,"daily_plans":7,"verified_job_checks":10}'::jsonb,'["ATS resume checks","Limited job search","Manual tracker","Draft-first safety"]'::jsonb,true,false,true),
  ('beta','Beta',0,0,'{"resume_uploads":10,"resume_analyses":50,"job_searches":150,"saved_jobs":250,"application_kits":40,"resume_variants":25,"cover_letters":60,"recruiter_emails":80,"linkedin_messages":60,"freelance_proposals":60,"exports":50,"followup_reminders":80,"job_refreshes":100,"ai_recommendations":120,"daily_plans":60,"verified_job_checks":150}'::jsonb,'["Temporary Pro limits","Feedback priority","Application kits","Source quality checks"]'::jsonb,true,false,true),
  ('pro','Pro',999,9990,'{"resume_uploads":20,"resume_analyses":100,"job_searches":300,"saved_jobs":500,"application_kits":100,"resume_variants":60,"cover_letters":150,"recruiter_emails":200,"linkedin_messages":150,"freelance_proposals":150,"exports":120,"followup_reminders":200,"job_refreshes":250,"ai_recommendations":250,"daily_plans":120,"verified_job_checks":300}'::jsonb,'["Higher search limits","Application kits","Resume variants","Email and proposal drafts","Follow-up planning"]'::jsonb,true,true,true),
  ('premium','Premium',1999,19990,'{"resume_uploads":-1,"resume_analyses":-1,"job_searches":-1,"saved_jobs":-1,"application_kits":-1,"resume_variants":-1,"cover_letters":-1,"recruiter_emails":-1,"linkedin_messages":-1,"freelance_proposals":-1,"exports":-1,"followup_reminders":-1,"job_refreshes":-1,"ai_recommendations":-1,"daily_plans":-1,"verified_job_checks":-1}'::jsonb,'["Premium usage limits","Advanced analytics","More exports","More verified checks","Priority support path"]'::jsonb,true,false,true),
  ('admin','Admin',0,0,'{"resume_uploads":-1,"resume_analyses":-1,"job_searches":-1,"saved_jobs":-1,"application_kits":-1,"resume_variants":-1,"cover_letters":-1,"recruiter_emails":-1,"linkedin_messages":-1,"freelance_proposals":-1,"exports":-1,"followup_reminders":-1,"job_refreshes":-1,"ai_recommendations":-1,"daily_plans":-1,"verified_job_checks":-1}'::jsonb,'["Internal operations access"]'::jsonb,false,false,true),
  ('custom','Custom / Enterprise',null,null,'{"resume_uploads":-1,"resume_analyses":-1,"job_searches":-1,"saved_jobs":-1,"application_kits":-1,"resume_variants":-1,"cover_letters":-1,"recruiter_emails":-1,"linkedin_messages":-1,"freelance_proposals":-1,"exports":-1,"followup_reminders":-1,"job_refreshes":-1,"ai_recommendations":-1,"daily_plans":-1,"verified_job_checks":-1}'::jsonb,'["Custom limits","Admin-managed setup","Team-ready billing foundation"]'::jsonb,true,false,true)
on conflict (plan_id) do update set
  name = excluded.name,
  monthly_price_inr = excluded.monthly_price_inr,
  yearly_price_inr = excluded.yearly_price_inr,
  limits = excluded.limits,
  features = excluded.features,
  visible = excluded.visible,
  recommended = excluded.recommended,
  active = excluded.active,
  updated_at = now();

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null references public.plan_catalog(plan_id) default 'free',
  billing_status text not null default 'manual' check (billing_status in ('manual','trialing','active','past_due','payment_failed','grace_period','cancelled','expired')),
  trial_plan text references public.plan_catalog(plan_id),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  cancelled_at timestamptz,
  grace_period_ends_at timestamptz,
  payment_provider text default 'manual' check (payment_provider in ('manual','razorpay','stripe','lemon_squeezy','paddle','not_configured')),
  provider_customer_id text,
  provider_subscription_id text,
  manual_override boolean not null default false,
  admin_note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_key text not null check (usage_key in (
    'resume_uploads','resume_analyses','job_searches','saved_jobs','application_kits',
    'resume_variants','cover_letters','recruiter_emails','linkedin_messages','freelance_proposals',
    'exports','followup_reminders','job_refreshes','ai_recommendations','daily_plans','verified_job_checks'
  )),
  period_type text not null default 'monthly' check (period_type in ('daily','monthly','lifetime')),
  period_key text not null,
  used integer not null default 0 check (used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_key, period_type, period_key)
);

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plan_catalog(plan_id),
  provider text not null default 'not_configured',
  status text not null default 'not_configured' check (status in ('not_configured','created','pending','completed','expired','cancelled','failed')),
  checkout_url text check (checkout_url is null or checkout_url ~* '^https?://'),
  provider_session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('razorpay','stripe','lemon_squeezy','paddle','manual')),
  provider_event_id text not null,
  event_type text not null check (event_type in ('subscription.created','subscription.renewed','subscription.cancelled','payment.successful','payment.failed','trial.started','trial.ended','refund.issued')),
  signature_verified boolean not null default false,
  processed boolean not null default false,
  processing_error text,
  user_id uuid references auth.users(id) on delete set null,
  provider_customer_id text,
  provider_subscription_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.plan_change_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_plan text,
  next_plan text not null,
  previous_status text,
  next_status text,
  reason text not null default 'admin',
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists usage_counters_user_period_idx on public.usage_counters (user_id, period_key);
create index if not exists user_subscriptions_plan_status_idx on public.user_subscriptions (plan_id, billing_status);
create index if not exists payment_webhook_events_processed_idx on public.payment_webhook_events (provider, processed, created_at desc);
create index if not exists checkout_sessions_user_created_idx on public.checkout_sessions (user_id, created_at desc);

alter table public.plan_catalog enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.plan_change_logs enable row level security;

drop policy if exists plan_catalog_public_select on public.plan_catalog;
create policy plan_catalog_public_select on public.plan_catalog
for select to anon, authenticated
using (visible and active);

drop policy if exists plan_catalog_admin_all on public.plan_catalog;
create policy plan_catalog_admin_all on public.plan_catalog
for all to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

drop policy if exists user_subscriptions_owner_select on public.user_subscriptions;
create policy user_subscriptions_owner_select on public.user_subscriptions
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists user_subscriptions_admin_all on public.user_subscriptions;
create policy user_subscriptions_admin_all on public.user_subscriptions
for all to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

drop policy if exists usage_counters_owner_select on public.usage_counters;
create policy usage_counters_owner_select on public.usage_counters
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists usage_counters_admin_all on public.usage_counters;
create policy usage_counters_admin_all on public.usage_counters
for all to authenticated
using (public.is_roledesk_admin())
with check (public.is_roledesk_admin());

drop policy if exists checkout_sessions_owner_select on public.checkout_sessions;
create policy checkout_sessions_owner_select on public.checkout_sessions
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

drop policy if exists checkout_sessions_admin_select on public.checkout_sessions;
create policy checkout_sessions_admin_select on public.checkout_sessions
for select to authenticated
using (public.is_roledesk_admin());

drop policy if exists payment_webhook_events_admin_select on public.payment_webhook_events;
create policy payment_webhook_events_admin_select on public.payment_webhook_events
for select to authenticated
using (public.is_roledesk_admin());

drop policy if exists plan_change_logs_owner_select on public.plan_change_logs;
create policy plan_change_logs_owner_select on public.plan_change_logs
for select to authenticated
using (auth.uid() = user_id or public.is_roledesk_admin());

revoke all on public.plan_catalog, public.user_subscriptions, public.usage_counters, public.checkout_sessions, public.payment_webhook_events, public.plan_change_logs from anon, authenticated;
grant select on public.plan_catalog to anon, authenticated;
grant select on public.user_subscriptions, public.usage_counters, public.checkout_sessions, public.plan_change_logs to authenticated;
grant select, insert, update on public.plan_catalog, public.user_subscriptions, public.usage_counters, public.checkout_sessions, public.payment_webhook_events, public.plan_change_logs to authenticated;

create or replace function public.current_period_key(p_period_type text default 'monthly')
returns text
language sql
stable
as $$
  select case
    when p_period_type = 'daily' then to_char(now(), 'YYYY-MM-DD')
    when p_period_type = 'lifetime' then 'lifetime'
    else to_char(now(), 'YYYY-MM')
  end;
$$;

create or replace function public.get_or_create_subscription(p_user_id uuid)
returns public.user_subscriptions
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.user_subscriptions;
  beta boolean;
  admin_user boolean;
begin
  if auth.uid() <> p_user_id and not public.is_roledesk_admin() then
    raise exception 'Access denied.' using errcode = '42501';
  end if;
  select public.is_roledesk_admin() into admin_user;
  select exists (
    select 1 from public.beta_access ba
    join auth.users u on lower(u.email) = lower(ba.email::text)
    where u.id = p_user_id
      and ba.active
      and (ba.expires_at is null or ba.expires_at > now())
  ) into beta;

  insert into public.user_subscriptions (user_id, plan_id, billing_status, payment_provider, manual_override)
  values (p_user_id, case when admin_user then 'admin' when beta then 'beta' else 'free' end, case when beta then 'trialing' else 'manual' end, 'manual', beta)
  on conflict (user_id) do nothing;

  select * into result from public.user_subscriptions where user_id = p_user_id;
  return result;
end;
$$;

create or replace function public.get_billing_status()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  sub public.user_subscriptions;
  usage jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  sub := public.get_or_create_subscription(auth.uid());
  select coalesce(jsonb_object_agg(usage_key, used), '{}'::jsonb)
    into usage
  from public.usage_counters
  where user_id = auth.uid()
    and period_type = 'monthly'
    and period_key = public.current_period_key('monthly');

  return jsonb_build_object(
    'plan', sub.plan_id,
    'billing_status', sub.billing_status,
    'trial_plan', sub.trial_plan,
    'trial_ends_at', sub.trial_ends_at,
    'renewal_date', sub.current_period_end,
    'payment_provider', sub.payment_provider,
    'usage_period', public.current_period_key('monthly'),
    'usage', coalesce(usage, '{}'::jsonb)
  );
end;
$$;

create or replace function public.record_usage_event(p_usage_key text, p_amount integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  sub public.user_subscriptions;
  plan_limits jsonb;
  current_limit integer;
  next_used integer;
  period text := public.current_period_key('monthly');
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_amount < 1 or p_amount > 100 then
    raise exception 'Invalid usage amount.' using errcode = '22023';
  end if;
  if p_usage_key not in ('resume_uploads','resume_analyses','job_searches','saved_jobs','application_kits','resume_variants','cover_letters','recruiter_emails','linkedin_messages','freelance_proposals','exports','followup_reminders','job_refreshes','ai_recommendations','daily_plans','verified_job_checks') then
    raise exception 'Invalid usage key.' using errcode = '22023';
  end if;

  sub := public.get_or_create_subscription(auth.uid());
  select limits into plan_limits from public.plan_catalog where plan_id = sub.plan_id;
  current_limit := coalesce((plan_limits ->> p_usage_key)::integer, 0);

  insert into public.usage_counters (user_id, usage_key, period_type, period_key, used)
  values (auth.uid(), p_usage_key, 'monthly', period, p_amount)
  on conflict (user_id, usage_key, period_type, period_key)
  do update set used = public.usage_counters.used + excluded.used, updated_at = now()
  returning used into next_used;

  if current_limit >= 0 and next_used > current_limit then
    insert into public.analytics_events (user_id, event_name, page, metadata)
    values (auth.uid(), 'usage_limit_hit', 'billing', jsonb_build_object('usage_key', p_usage_key, 'plan', sub.plan_id, 'used', next_used, 'limit', current_limit));
  end if;

  return jsonb_build_object('usage_key', p_usage_key, 'used', next_used, 'limit', current_limit, 'allowed', current_limit < 0 or next_used <= current_limit);
end;
$$;

create or replace function public.create_checkout_placeholder(p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_plan not in ('pro','premium','custom','beta') then
    raise exception 'Invalid checkout plan.' using errcode = '22023';
  end if;

  insert into public.checkout_sessions (user_id, plan_id, provider, status, metadata)
  values (auth.uid(), p_plan, 'not_configured', 'not_configured', jsonb_build_object('message', 'Payment integration is not active yet. Contact admin for beta/pro access.'))
  returning id into session_id;

  insert into public.analytics_events (user_id, event_name, page, metadata)
  values (auth.uid(), 'upgrade_attempted', 'plans', jsonb_build_object('plan', p_plan, 'checkout_session_id', session_id, 'provider', 'not_configured'));

  return jsonb_build_object('checkoutUrl', null, 'status', 'not_configured', 'message', 'Payment integration is not active yet. Contact admin for beta/pro access.');
end;
$$;

create or replace function public.admin_assign_user_plan(
  p_email text,
  p_plan text,
  p_billing_status text default 'manual',
  p_trial_days integer default 0,
  p_note text default null
)
returns public.user_subscriptions
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target auth.users;
  previous public.user_subscriptions;
  result public.user_subscriptions;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if p_plan not in ('free','beta','pro','premium','admin','custom') then
    raise exception 'Invalid plan.' using errcode = '22023';
  end if;
  if p_billing_status not in ('manual','trialing','active','past_due','payment_failed','grace_period','cancelled','expired') then
    raise exception 'Invalid billing status.' using errcode = '22023';
  end if;
  select * into target from auth.users where lower(email) = lower(p_email) limit 1;
  if target.id is null then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  previous := public.get_or_create_subscription(target.id);
  insert into public.user_subscriptions (
    user_id, plan_id, billing_status, trial_plan, trial_started_at, trial_ends_at,
    subscription_started_at, payment_provider, manual_override, admin_note, updated_by, updated_at
  )
  values (
    target.id, p_plan, p_billing_status,
    case when p_trial_days > 0 then p_plan else null end,
    case when p_trial_days > 0 then now() else null end,
    case when p_trial_days > 0 then now() + make_interval(days => p_trial_days) else null end,
    case when p_billing_status = 'active' then now() else previous.subscription_started_at end,
    'manual', true, left(coalesce(p_note, ''), 1000), auth.uid(), now()
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    billing_status = excluded.billing_status,
    trial_plan = excluded.trial_plan,
    trial_started_at = excluded.trial_started_at,
    trial_ends_at = excluded.trial_ends_at,
    subscription_started_at = coalesce(excluded.subscription_started_at, public.user_subscriptions.subscription_started_at),
    payment_provider = 'manual',
    manual_override = true,
    admin_note = excluded.admin_note,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into result;

  insert into public.plan_change_logs (user_id, previous_plan, next_plan, previous_status, next_status, reason, changed_by, note)
  values (target.id, previous.plan_id, result.plan_id, previous.billing_status, result.billing_status, 'admin_assignment', auth.uid(), left(coalesce(p_note, ''), 1000));

  return result;
end;
$$;

create or replace function public.admin_reset_user_usage(p_email text)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target auth.users;
  count_deleted integer;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select * into target from auth.users where lower(email) = lower(p_email) limit 1;
  if target.id is null then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  delete from public.usage_counters where user_id = target.id and period_key = public.current_period_key('monthly');
  get diagnostics count_deleted = row_count;
  insert into public.plan_change_logs (user_id, previous_plan, next_plan, reason, changed_by, note)
  values (target.id, null, 'usage_reset', 'admin_usage_reset', auth.uid(), 'Current month usage reset');
  return count_deleted;
end;
$$;

create or replace function public.admin_billing_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'users_by_plan', coalesce((select jsonb_object_agg(plan_id, count) from (select plan_id, count(*)::int from public.user_subscriptions group by plan_id) x), '{}'::jsonb),
      'trial_users', (select count(*)::int from public.user_subscriptions where billing_status = 'trialing'),
      'failed_payments', (select count(*)::int from public.user_subscriptions where billing_status in ('payment_failed','past_due')),
      'cancelled_subscriptions', (select count(*)::int from public.user_subscriptions where billing_status = 'cancelled'),
      'upgrade_attempts', (select count(*)::int from public.analytics_events where event_name = 'upgrade_attempted' and created_at >= now() - interval '30 days'),
      'usage_limit_hits', (select count(*)::int from public.analytics_events where event_name = 'usage_limit_hit' and created_at >= now() - interval '30 days')
    ),
    'users', coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc) from (
      select u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as display_name,
        s.plan_id as plan, s.billing_status, s.trial_ends_at, s.current_period_end, s.payment_provider, s.updated_at
      from public.user_subscriptions s
      join auth.users u on u.id = s.user_id
      order by s.updated_at desc
      limit 100
    ) row_data), '[]'::jsonb),
    'webhook_logs', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from (
      select provider, provider_event_id, event_type, signature_verified, processed, processing_error, created_at
      from public.payment_webhook_events
      order by created_at desc
      limit 50
    ) w), '[]'::jsonb)
  );
end;
$$;

create or replace function public.process_payment_webhook(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_signature_verified boolean,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  existing public.payment_webhook_events;
  target_user uuid;
  provider_customer text := p_payload ->> 'customer_id';
  provider_subscription text := p_payload ->> 'subscription_id';
  next_status text;
begin
  if p_provider not in ('razorpay','stripe','lemon_squeezy','paddle','manual') then
    raise exception 'Invalid payment provider.' using errcode = '22023';
  end if;
  if not p_signature_verified then
    insert into public.payment_webhook_events (provider, provider_event_id, event_type, signature_verified, processed, processing_error, payload)
    values (p_provider, p_provider_event_id, p_event_type, false, false, 'Signature not verified', p_payload)
    on conflict (provider, provider_event_id) do nothing;
    raise exception 'Webhook signature not verified.' using errcode = '42501';
  end if;

  select * into existing from public.payment_webhook_events where provider = p_provider and provider_event_id = p_provider_event_id;
  if existing.id is not null and existing.processed then
    return jsonb_build_object('status', 'duplicate_ignored');
  end if;

  select user_id into target_user
  from public.user_subscriptions
  where provider_customer_id = provider_customer or provider_subscription_id = provider_subscription
  limit 1;

  next_status := case
    when p_event_type in ('subscription.created','subscription.renewed','payment.successful') then 'active'
    when p_event_type = 'payment.failed' then 'payment_failed'
    when p_event_type = 'subscription.cancelled' then 'cancelled'
    when p_event_type = 'trial.started' then 'trialing'
    when p_event_type = 'trial.ended' then 'expired'
    else null
  end;

  insert into public.payment_webhook_events (provider, provider_event_id, event_type, signature_verified, processed, user_id, provider_customer_id, provider_subscription_id, payload, processed_at)
  values (p_provider, p_provider_event_id, p_event_type, true, true, target_user, provider_customer, provider_subscription, p_payload, now())
  on conflict (provider, provider_event_id) do update set
    signature_verified = true,
    processed = true,
    user_id = coalesce(excluded.user_id, public.payment_webhook_events.user_id),
    provider_customer_id = excluded.provider_customer_id,
    provider_subscription_id = excluded.provider_subscription_id,
    payload = excluded.payload,
    processed_at = now();

  if target_user is not null and next_status is not null then
    update public.user_subscriptions
    set billing_status = next_status,
        grace_period_ends_at = case when next_status = 'payment_failed' then now() + interval '7 days' else grace_period_ends_at end,
        cancelled_at = case when next_status = 'cancelled' then now() else cancelled_at end,
        payment_provider = p_provider,
        updated_at = now()
    where user_id = target_user;
  end if;

  return jsonb_build_object('status', 'processed', 'user_id', target_user, 'billing_status', next_status);
end;
$$;

revoke all on function public.current_period_key(text) from public, anon;
revoke all on function public.get_or_create_subscription(uuid) from public, anon;
revoke all on function public.get_billing_status() from public, anon;
revoke all on function public.record_usage_event(text, integer) from public, anon;
revoke all on function public.create_checkout_placeholder(text) from public, anon;
revoke all on function public.admin_assign_user_plan(text, text, text, integer, text) from public, anon;
revoke all on function public.admin_reset_user_usage(text) from public, anon;
revoke all on function public.admin_billing_dashboard() from public, anon;
revoke all on function public.process_payment_webhook(text, text, text, boolean, jsonb) from public, anon, authenticated;

grant execute on function public.current_period_key(text) to authenticated;
grant execute on function public.get_billing_status() to authenticated;
grant execute on function public.record_usage_event(text, integer) to authenticated;
grant execute on function public.create_checkout_placeholder(text) to authenticated;
grant execute on function public.admin_assign_user_plan(text, text, text, integer, text) to authenticated;
grant execute on function public.admin_reset_user_usage(text) to authenticated;
grant execute on function public.admin_billing_dashboard() to authenticated;
grant execute on function public.process_payment_webhook(text, text, text, boolean, jsonb) to service_role;

commit;
