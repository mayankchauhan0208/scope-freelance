begin;

alter table public.opportunities
  add column if not exists trust_score integer check (trust_score is null or trust_score between 0 and 100),
  add column if not exists verification_status text not null default 'needs_verification'
    check (verification_status in ('official_company','verified_by_feed','needs_verification','user_verified')),
  add column if not exists expiry_status text not null default 'needs_verification'
    check (expiry_status in ('active','recently_posted','possibly_stale','expired','closed','needs_verification')),
  add column if not exists last_checked_at timestamptz,
  add column if not exists source_reliability integer check (source_reliability is null or source_reliability between 0 and 100),
  add column if not exists all_source_links text[] not null default '{}',
  add column if not exists check_failures integer not null default 0 check (check_failures between 0 and 20),
  add column if not exists company_careers_url text check (company_careers_url is null or company_careers_url ~* '^https?://');

create table if not exists public.job_sources (
  id text primary key, name text not null, source_type text not null,
  status text not null default 'active' check (status in ('active','failed','disabled')),
  reliability_score integer not null check (reliability_score between 0 and 100),
  official_url text not null check (official_url ~* '^https?://'),
  fetch_method text not null, limitations text, last_reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.job_sources(id,name,source_type,status,reliability_score,official_url,fetch_method,limitations)
values
 ('remotive','Remotive','public_api','active',86,'https://remotive.com/remote-jobs','Permitted public JSON API','Public-feed coverage only; applications remain manual.'),
 ('arbeitnow','Arbeitnow','public_api','active',82,'https://www.arbeitnow.com/','Permitted public JSON API','Public-feed coverage only; applications remain manual.')
on conflict(id) do update set name=excluded.name,source_type=excluded.source_type,reliability_score=excluded.reliability_score,official_url=excluded.official_url,fetch_method=excluded.fetch_method,limitations=excluded.limitations,updated_at=now();

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  normalized_name text not null, display_name text not null, website text check (website is null or website ~* '^https?://'),
  careers_url text check (careers_url is null or careers_url ~* '^https?://'), industry text, company_size text,
  headquarters text, company_page_url text check (company_page_url is null or company_page_url ~* '^https?://'),
  verified_hiring_emails jsonb not null default '[]'::jsonb, source_reliability integer check (source_reliability is null or source_reliability between 0 and 100),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,normalized_name)
);

create table if not exists public.opportunity_verifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null, verification_type text not null check (verification_type in ('feed_presence','application_link','company_careers','manual_review')),
  result text not null check (result in ('active','not_found','failed','closed','needs_verification')),
  checked_url text check (checked_url is null or checked_url ~* '^https?://'), evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(), created_at timestamptz not null default now(),
  constraint opportunity_verifications_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null, report_type text not null check (report_type in ('closed','wrong_details','fake_job','already_filled')),
  notes text, status text not null default 'open' check (status in ('open','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint job_reports_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);

alter table public.job_sources enable row level security;
drop policy if exists job_sources_authenticated_select on public.job_sources;
drop policy if exists job_sources_admin_write on public.job_sources;
create policy job_sources_authenticated_select on public.job_sources for select to authenticated using (true);
create policy job_sources_admin_write on public.job_sources for all to authenticated using (public.is_roledesk_admin()) with check (public.is_roledesk_admin());
revoke all on public.job_sources from anon;
grant select on public.job_sources to authenticated;

do $$ declare table_name text; begin
  foreach table_name in array array['company_profiles','opportunity_verifications','job_reports'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_select',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_insert',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_update',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_owner_delete',table_name);
    execute format('create policy %I on public.%I for select using (auth.uid()=user_id)',table_name||'_owner_select',table_name);
    execute format('create policy %I on public.%I for insert with check (auth.uid()=user_id)',table_name||'_owner_insert',table_name);
    execute format('create policy %I on public.%I for update using (auth.uid()=user_id) with check (auth.uid()=user_id)',table_name||'_owner_update',table_name);
    execute format('create policy %I on public.%I for delete using (auth.uid()=user_id)',table_name||'_owner_delete',table_name);
    execute format('revoke all on public.%I from anon',table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['job_sources','company_profiles','job_reports'] loop
    execute format('drop trigger if exists %I on public.%I','set_'||table_name||'_updated_at',table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()','set_'||table_name||'_updated_at',table_name);
  end loop;
end $$;

commit;
