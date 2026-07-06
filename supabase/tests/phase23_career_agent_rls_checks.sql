begin;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-4000-8000-0000000000c3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase23-a@example.test',crypt('phase23-test-password',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-4000-8000-0000000000d4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase23-b@example.test',crypt('phase23-test-password',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
insert into public.career_targets(user_id,target_roles) values ('00000000-0000-4000-8000-0000000000c3',array['Product Designer']);
insert into public.daily_plans(user_id,plan_date,actions) values ('00000000-0000-4000-8000-0000000000c3',current_date,'[{"title":"Private action"}]');
insert into public.resume_variants(user_id,name,target_role) values ('00000000-0000-4000-8000-0000000000c3','Private variant','Product Designer');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000d4","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000d4',true);
do $$ begin
  if (select count(*) from public.career_targets where user_id='00000000-0000-4000-8000-0000000000c3') <> 0 then raise exception 'User B can read User A career target'; end if;
  if (select count(*) from public.daily_plans where user_id='00000000-0000-4000-8000-0000000000c3') <> 0 then raise exception 'User B can read User A plan'; end if;
  if (select count(*) from public.resume_variants where user_id='00000000-0000-4000-8000-0000000000c3') <> 0 then raise exception 'User B can read User A variant'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
  if has_table_privilege('anon','public.career_targets','select') then raise exception 'anon can select career_targets'; end if;
  if has_table_privilege('anon','public.daily_plans','select') then raise exception 'anon can select daily_plans'; end if;
  if has_table_privilege('anon','public.resume_variants','select') then raise exception 'anon can select resume_variants'; end if;
  if has_table_privilege('anon','public.opportunity_feedback','select') then raise exception 'anon can select opportunity_feedback'; end if;
end $$;
reset role;
do $$ declare t text; begin
  foreach t in array array['career_targets','daily_plans','career_recommendations','resume_variants','opportunity_feedback','interview_preparations','notifications','reminder_settings','calendar_events'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS disabled on %',t; end if;
    if (select count(*) from pg_policies where schemaname='public' and tablename=t) < 4 then raise exception 'Owner CRUD policies incomplete on %',t; end if;
  end loop;
end $$;
rollback;
