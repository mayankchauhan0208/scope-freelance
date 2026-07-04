begin;

create extension if not exists citext;

create table if not exists public.admin_users (
  email citext primary key,
  active boolean not null default true,
  role text not null default 'beta_admin' check (role in ('beta_admin')),
  created_at timestamptz not null default now()
);

insert into public.admin_users (email, active, role)
values
  ('mayankchauhan0208@gmail.com', true, 'beta_admin'),
  ('connect.mayankchauhan@gmail.com', true, 'beta_admin')
on conflict (email) do update set active = true, role = excluded.role;

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_roledesk_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.email = nullif(auth.jwt() ->> 'email', '')
      and a.active = true
  );
$$;

revoke all on function public.is_roledesk_admin() from public, anon;
grant execute on function public.is_roledesk_admin() to authenticated;

drop policy if exists admin_users_admin_select on public.admin_users;
create policy admin_users_admin_select
on public.admin_users for select
to authenticated
using (public.is_roledesk_admin());

grant select on public.admin_users to authenticated;

drop policy if exists beta_access_admin_select on public.beta_access;
create policy beta_access_admin_select
on public.beta_access for select
to authenticated
using (public.is_roledesk_admin());

grant select on public.beta_access to authenticated;

drop policy if exists feedback_admin_select on public.feedback;
create policy feedback_admin_select
on public.feedback for select
to authenticated
using (public.is_roledesk_admin());

grant select on public.feedback to authenticated;

-- Expand the existing non-destructive status check to the beta operations workflow.
update public.feedback
set status = case status
  when 'reviewing' then 'reviewed'
  when 'resolved' then 'fixed'
  when 'closed' then 'archived'
  else status
end
where status in ('reviewing', 'resolved', 'closed');

alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback
  add constraint feedback_status_check
  check (status in ('new','reviewed','planned','fixed','archived'));

create or replace function public.admin_add_beta_user(
  p_email text,
  p_note text default null,
  p_expires_at timestamptz default null
)
returns public.beta_access
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.beta_access;
  normalized_email citext := lower(trim(p_email));
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if normalized_email is null or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Note must be 500 characters or fewer.' using errcode = '22023';
  end if;

  insert into public.beta_access (email, active, invited_by, note, expires_at)
  values (normalized_email, true, auth.uid(), nullif(trim(p_note), ''), p_expires_at)
  on conflict (email) do update set
    active = true,
    invited_by = auth.uid(),
    note = excluded.note,
    expires_at = excluded.expires_at
  returning * into result;
  return result;
end;
$$;

create or replace function public.admin_update_beta_user(
  p_email text,
  p_active boolean,
  p_note text default null,
  p_expires_at timestamptz default null
)
returns public.beta_access
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.beta_access;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Note must be 500 characters or fewer.' using errcode = '22023';
  end if;

  update public.beta_access
  set active = p_active,
      note = nullif(trim(p_note), ''),
      expires_at = p_expires_at
  where email = lower(trim(p_email))
  returning * into result;
  if result.email is null then
    raise exception 'Beta user not found.' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.admin_deactivate_beta_user(p_email text)
returns public.beta_access
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.beta_access;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  update public.beta_access
  set active = false
  where email = lower(trim(p_email))
  returning * into result;
  if result.email is null then
    raise exception 'Beta user not found.' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.admin_update_feedback_status(
  p_feedback_id uuid,
  p_status text
)
returns public.feedback
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result public.feedback;
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if p_status not in ('new','reviewed','planned','fixed','archived') then
    raise exception 'Invalid feedback status.' using errcode = '22023';
  end if;

  update public.feedback
  set status = p_status
  where id = p_feedback_id
  returning * into result;
  if result.id is null then
    raise exception 'Feedback not found.' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.admin_add_beta_user(text, text, timestamptz) from public, anon;
revoke all on function public.admin_update_beta_user(text, boolean, text, timestamptz) from public, anon;
revoke all on function public.admin_deactivate_beta_user(text) from public, anon;
revoke all on function public.admin_update_feedback_status(uuid, text) from public, anon;
grant execute on function public.admin_add_beta_user(text, text, timestamptz) to authenticated;
grant execute on function public.admin_update_beta_user(text, boolean, text, timestamptz) to authenticated;
grant execute on function public.admin_deactivate_beta_user(text) to authenticated;
grant execute on function public.admin_update_feedback_status(uuid, text) to authenticated;

commit;
