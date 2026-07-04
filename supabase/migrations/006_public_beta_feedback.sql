begin;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  feedback_type text not null check (feedback_type in (
    'Bug','Confusing UI','Bad job match','Resume issue','Draft issue','Feature request','Other'
  )),
  page text,
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new','reviewing','resolved','closed')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_created_idx
  on public.feedback (user_id, created_at desc)
  where user_id is not null;

alter table public.feedback enable row level security;

drop policy if exists feedback_client_insert on public.feedback;
create policy feedback_client_insert
on public.feedback for insert
to anon, authenticated
with check (
  (auth.uid() is null and user_id is null)
  or auth.uid() = user_id
);

drop policy if exists feedback_owner_select on public.feedback;
create policy feedback_owner_select
on public.feedback for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;

commit;
