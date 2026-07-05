begin;

-- Public customer signup: beta_access remains available for cohorts and notes,
-- but it no longer gates creation of a normal authenticated workspace.
drop trigger if exists enforce_beta_access_before_signup on auth.users;

-- Profile creation is deliberately minimal and non-blocking. Private profile
-- content is still written by the authenticated user under owner-only RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  begin
    insert into public.profiles (user_id, display_name, work_email, preferences)
    values (
      new.id,
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
      lower(new.email),
      '{}'::jsonb
    )
    on conflict (user_id) do update
    set work_email = coalesce(public.profiles.work_email, excluded.work_email),
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();
  exception when others then
    raise warning 'RoleDesk profile bootstrap skipped for auth user %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;
