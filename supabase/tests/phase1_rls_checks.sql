-- Run in the Supabase SQL editor against a non-production project when possible.
-- This script is transactional and rolls back its test users and rows.
begin;

insert into public.beta_access (email, note)
values ('phase1-a@example.test', 'RLS test'), ('phase1-b@example.test', 'RLS test')
on conflict (email) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase1-a@example.test', crypt('phase1-test-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase1-b@example.test', crypt('phase1-test-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.profiles (user_id, display_name)
values ('00000000-0000-4000-8000-0000000000a1', 'Phase 1 User A');

insert into public.opportunities (id, user_id, source, source_url, title, status)
values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'test', 'https://example.test/a', 'User A opportunity', 'saved');

insert into public.drafts (id, user_id, opportunity_id, kind, recipient, subject, body)
values ('20000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', 'email', 'client@example.test', 'Subject A', 'Body A');

select public.approve_draft('20000000-0000-4000-8000-0000000000a1');

-- Manual negative check: this must fail with a column-permission error.
-- update public.drafts set approval_state = 'user_approved'
-- where id = '20000000-0000-4000-8000-0000000000a1';

-- Manual negative check: this must fail because trusted logs have no client insert grant.
-- insert into public.activity_logs (user_id, event_type)
-- values ('00000000-0000-4000-8000-0000000000a1', 'draft.approved');

update public.drafts set body = 'Changed after approval' where id = '20000000-0000-4000-8000-0000000000a1';

-- Expected: revoked, with approved_at/content_hash cleared.
select id, approval_state, approved_at, approved_by, content_hash
from public.drafts
where id = '20000000-0000-4000-8000-0000000000a1';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Expected: every count is zero. User B cannot see User A rows.
select
  (select count(*) from public.profiles where user_id = '00000000-0000-4000-8000-0000000000a1') as profiles_visible,
  (select count(*) from public.opportunities where user_id = '00000000-0000-4000-8000-0000000000a1') as opportunities_visible,
  (select count(*) from public.drafts where user_id = '00000000-0000-4000-8000-0000000000a1') as drafts_visible,
  (select count(*) from public.activity_logs where user_id = '00000000-0000-4000-8000-0000000000a1') as logs_visible;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

-- Expected: every anonymous count is zero.
select
  (select count(*) from public.profiles) as anonymous_profiles,
  (select count(*) from public.resumes) as anonymous_resumes,
  (select count(*) from public.opportunities) as anonymous_opportunities,
  (select count(*) from public.drafts) as anonymous_drafts,
  (select count(*) from public.applications) as anonymous_applications,
  (select count(*) from public.activity_logs) as anonymous_logs;

reset role;
rollback;
