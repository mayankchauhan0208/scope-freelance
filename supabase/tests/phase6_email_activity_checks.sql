-- Run after migration 004. Transactional; all test rows are rolled back.
begin;

insert into public.beta_access (email, note)
values ('phase6-a@example.test','Email activity RLS test'),('phase6-b@example.test','Email activity RLS test')
on conflict (email) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-4000-8000-0000000006a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase6-a@example.test',crypt('phase6-test-password',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-4000-8000-0000000006b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase6-b@example.test',crypt('phase6-test-password',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000006a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.drafts (id,user_id,kind,recipient,subject,body,content)
values ('60000000-0000-4000-8000-0000000006a1','00000000-0000-4000-8000-0000000006a1','email','client@example.test','Test subject','Reviewed body','{"mode":"manual-gmail-compose"}');

select public.record_email_client_event('60000000-0000-4000-8000-0000000006a1','email.marked_sent','{"status":"Sent Manually"}');

-- Expected: false, user_reported, and provider_confirmed false.
select event_type,metadata->>'trusted' as trusted,metadata->>'verification' as verification,metadata->>'provider_confirmed' as provider_confirmed
from public.activity_logs where entity_id='60000000-0000-4000-8000-0000000006a1';

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000006b2',true);

-- Expected: zero. User B cannot read User A activity.
select count(*) as user_a_events_visible_to_user_b
from public.activity_logs where user_id='00000000-0000-4000-8000-0000000006a1';

reset role;
rollback;
