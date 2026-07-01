begin;

alter table public.resumes
  add column if not exists original_text text,
  add column if not exists extracted_data jsonb not null default '{}'::jsonb,
  add column if not exists ats_score integer,
  add column if not exists issues jsonb not null default '{}'::jsonb,
  add column if not exists generated_text text,
  add column if not exists tone text,
  add column if not exists target_role text,
  add column if not exists version_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.resumes'::regclass
      and conname = 'resumes_ats_score_allowed'
  ) then
    alter table public.resumes
      add constraint resumes_ats_score_allowed
      check (ats_score is null or ats_score between 0 and 100)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.resumes'::regclass
      and conname = 'resumes_tone_allowed'
  ) then
    alter table public.resumes
      add constraint resumes_tone_allowed
      check (
        tone is null or tone in (
          'Corporate','Creative Professional','MNC-focused',
          'Freelance-focused','Design/Marketing-focused'
        )
      ) not valid;
  end if;
end $$;

alter table public.resumes validate constraint resumes_ats_score_allowed;
alter table public.resumes validate constraint resumes_tone_allowed;

create index if not exists resumes_user_updated_idx
  on public.resumes (user_id, updated_at desc);

alter table public.resumes enable row level security;

commit;
