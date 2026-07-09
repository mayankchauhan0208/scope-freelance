begin;
set local role anon;
do $$ begin
  if has_table_privilege('anon','public.job_sources','select') then raise exception 'anon can read source registry'; end if;
  if has_table_privilege('anon','public.company_profiles','select') then raise exception 'anon can read company profiles'; end if;
  if has_table_privilege('anon','public.opportunity_verifications','select') then raise exception 'anon can read opportunity checks'; end if;
  if has_table_privilege('anon','public.job_reports','select') then raise exception 'anon can read job reports'; end if;
end $$;
reset role;
do $$ declare t text; begin
  foreach t in array array['job_sources','company_profiles','opportunity_verifications','job_reports'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS disabled on %',t; end if;
  end loop;
  if (select count(*) from public.job_sources where id in ('remotive','arbeitnow')) <> 2 then raise exception 'Live source registry seed missing'; end if;
end $$;
rollback;
