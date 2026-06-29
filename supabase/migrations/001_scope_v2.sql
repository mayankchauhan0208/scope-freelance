create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  work_email text,
  resume_text text,
  portfolio_urls jsonb not null default '[]',
  preferences jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_id text,
  source_url text not null,
  title text not null,
  company text,
  description text,
  contact_email text,
  status text not null default 'discovered',
  match_score integer check (match_score between 0 and 100),
  analysis jsonb not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, source_url)
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  kind text not null check (kind in ('proposal','email','form','reply','negotiation')),
  destination jsonb not null default '{}',
  content jsonb not null default '{}',
  approval_state text not null default 'draft_ready' check (approval_state in ('draft_ready','user_approved','externally_completed','revoked')),
  content_hash text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  draft_id uuid references public.drafts(id) on delete set null,
  event text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.drafts enable row level security;
alter table public.audit_log enable row level security;

create policy "profile owner access" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "opportunity owner access" on public.opportunities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "draft owner access" on public.drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "audit owner read" on public.audit_log for select using (auth.uid() = user_id);
