begin;

create table if not exists public.career_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  target_roles text[] not null default '{}', preferred_locations text[] not null default '{}',
  work_mode text check (work_mode is null or work_mode in ('remote','hybrid','onsite')),
  minimum_salary numeric check (minimum_salary is null or minimum_salary >= 0),
  expected_salary numeric check (expected_salary is null or expected_salary >= 0),
  experience_level text, industries text[] not null default '{}', company_sizes text[] not null default '{}',
  preferred_job_boards text[] not null default '{}', notice_period text, work_authorization text,
  portfolio_url text check (portfolio_url is null or portfolio_url ~* '^https?://'),
  linkedin_url text check (linkedin_url is null or linkedin_url ~* '^https?://'),
  links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null default current_date, actions jsonb not null default '[]'::jsonb,
  completed_action_keys text[] not null default '{}', generated_by text not null default 'local_explainable_v1',
  generated_at timestamptz not null default now(), archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, plan_date), check (jsonb_typeof(actions) = 'array')
);

create table if not exists public.career_recommendations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid, recommendation_type text not null,
  title text not null, explanation text not null, score integer check (score is null or score between 0 and 100),
  evidence jsonb not null default '[]'::jsonb, status text not null default 'active' check (status in ('active','completed','dismissed','archived')),
  generated_by text not null default 'local_explainable_v1', generated_at timestamptz not null default now(), archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint career_recommendations_opportunity_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);

create table if not exists public.resume_variants (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source_resume_id uuid, name text not null, target_role text not null, summary text, skills text[] not null default '{}',
  content jsonb not null default '{}'::jsonb, truth_reviewed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint resume_variants_resume_owner_fk foreign key (source_resume_id,user_id) references public.resumes(id,user_id) on delete restrict
);
create unique index if not exists resume_variants_id_user_uidx on public.resume_variants(id,user_id);

create table if not exists public.opportunity_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid, resume_variant_id uuid,
  outcome text not null check (outcome in ('no_reply','replied','interview','rejected','offer','not_interested','wrong_role','fake_job','already_filled','applied_externally')),
  role_type text, source text, notes text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint opportunity_feedback_opportunity_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade,
  constraint opportunity_feedback_variant_owner_fk foreign key (resume_variant_id,user_id) references public.resume_variants(id,user_id) on delete restrict
);

create table if not exists public.interview_preparations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null, questions jsonb not null default '[]'::jsonb, talking_points jsonb not null default '[]'::jsonb,
  company_notes text, portfolio_projects jsonb not null default '[]'::jsonb, weak_areas jsonb not null default '[]'::jsonb,
  salary_notes text, questions_to_ask jsonb not null default '[]'::jsonb, interview_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,opportunity_id),
  constraint interview_preparations_opportunity_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('followup_due','strong_match','interview_upcoming','resume_improvement','email_failed','deadline_near','job_stale','daily_plan_ready')),
  title text not null, message text not null, entity_type text, entity_id uuid, due_at timestamptz, read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_notifications boolean not null default false, dashboard_notifications boolean not null default true,
  followup_reminders boolean not null default true, daily_plan_frequency text not null default 'daily' check (daily_plan_frequency in ('daily','weekdays','off')),
  timezone text not null default 'UTC', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid, event_type text not null check (event_type in ('interview','followup','application_deadline','reminder','job_search_block')),
  title text not null, starts_at timestamptz not null, ends_at timestamptz, timezone text not null default 'UTC', notes text,
  external_calendar_id text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  constraint calendar_events_opportunity_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);

alter table public.applications add column if not exists resume_variant_id uuid;
alter table public.applications drop constraint if exists applications_resume_variant_owner_fk;
alter table public.applications add constraint applications_resume_variant_owner_fk foreign key (resume_variant_id,user_id) references public.resume_variants(id,user_id) on delete restrict;

do $$ declare table_name text; begin
  foreach table_name in array array['career_targets','daily_plans','career_recommendations','resume_variants','opportunity_feedback','interview_preparations','notifications','reminder_settings','calendar_events'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_select',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_insert',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_update',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_delete',table_name);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)',table_name||'_owner_select',table_name);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)',table_name||'_owner_insert',table_name);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',table_name||'_owner_update',table_name);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)',table_name||'_owner_delete',table_name);
    execute format('revoke all on public.%I from anon',table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['career_targets','daily_plans','career_recommendations','resume_variants','opportunity_feedback','interview_preparations','reminder_settings','calendar_events'] loop
    execute format('drop trigger if exists %I on public.%I','set_'||table_name||'_updated_at',table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()','set_'||table_name||'_updated_at',table_name);
  end loop;
end $$;

commit;
