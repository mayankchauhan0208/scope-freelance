begin;

alter table public.resume_variants
  add column if not exists use_count integer not null default 0 check (use_count >= 0),
  add column if not exists reply_count integer not null default 0 check (reply_count >= 0),
  add column if not exists interview_count integer not null default 0 check (interview_count >= 0),
  add column if not exists poor_fit_count integer not null default 0 check (poor_fit_count >= 0),
  add column if not exists last_used_at timestamptz;

create table if not exists public.application_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid,
  resume_variant_id uuid,
  title text not null,
  target_role text,
  tone text,
  status text not null default 'draft' check (status in ('draft','reviewed','applied_manually','archived')),
  scores jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  suggestions jsonb not null default '[]'::jsonb check (jsonb_typeof(suggestions) = 'array'),
  truth_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(truth_warnings) = 'array'),
  generated_by text not null default 'local_truth_guarded_v1',
  applied_at timestamptz,
  followup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_kits_opportunity_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade,
  constraint application_kits_variant_owner_fk foreign key (resume_variant_id,user_id) references public.resume_variants(id,user_id) on delete restrict
);
create unique index if not exists application_kits_id_user_uidx on public.application_kits(id,user_id);
create index if not exists application_kits_user_updated_idx on public.application_kits(user_id, updated_at desc);

create table if not exists public.application_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_kit_id uuid,
  opportunity_id uuid,
  asset_type text not null check (asset_type in ('tailored_resume','cover_letter','recruiter_email','linkedin_message','follow_up_email','freelance_proposal','application_note','other')),
  title text,
  content text not null,
  version integer not null default 1 check (version > 0),
  quality_score integer check (quality_score is null or quality_score between 0 and 100),
  truth_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(truth_warnings) = 'array'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_assets_kit_owner_fk foreign key (application_kit_id,user_id) references public.application_kits(id,user_id) on delete cascade,
  constraint application_assets_opportunity_owner_fk foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);
create index if not exists application_assets_user_kit_idx on public.application_assets(user_id, application_kit_id, created_at desc);

create table if not exists public.export_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_kit_id uuid,
  asset_id uuid,
  asset_type text,
  export_format text not null check (export_format in ('txt','md','doc','pdf','copy','html')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint export_history_kit_owner_fk foreign key (application_kit_id,user_id) references public.application_kits(id,user_id) on delete cascade,
  constraint export_history_asset_owner_fk foreign key (asset_id,user_id) references public.application_assets(id,user_id) on delete cascade
);
create index if not exists export_history_user_created_idx on public.export_history(user_id, created_at desc);

create table if not exists public.content_quality_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_kit_id uuid,
  asset_id uuid,
  asset_type text not null,
  score integer check (score is null or score between 0 and 100),
  factors jsonb not null default '{}'::jsonb,
  fixes jsonb not null default '[]'::jsonb check (jsonb_typeof(fixes) = 'array'),
  created_at timestamptz not null default now(),
  constraint content_quality_kit_owner_fk foreign key (application_kit_id,user_id) references public.application_kits(id,user_id) on delete cascade,
  constraint content_quality_asset_owner_fk foreign key (asset_id,user_id) references public.application_assets(id,user_id) on delete cascade
);
create index if not exists content_quality_user_created_idx on public.content_quality_scores(user_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['application_kits','application_assets','export_history','content_quality_scores'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', table_name || '_owner_select', table_name);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', table_name || '_owner_insert', table_name);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name || '_owner_update', table_name);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', table_name || '_owner_delete', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['application_kits','application_assets'] loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;
end $$;

commit;
