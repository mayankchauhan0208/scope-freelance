-- Run after migration 003. This test is transactional and rolls back all rows.
begin;

insert into public.beta_access (email, note)
values ('phase3-a@example.test', 'Resume RLS test'), ('phase3-b@example.test', 'Resume RLS test')
on conflict (email) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-a@example.test', crypt('phase3-test-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-4000-8000-0000000003b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3-b@example.test', crypt('phase3-test-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000003a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.resumes (user_id, file_name, original_text, extracted_data, ats_score, generated_text, tone, version_name)
values ('00000000-0000-4000-8000-0000000003a1', 'User A resume', 'Verified source text', '{"ai_used":false}', 75, 'Generated local version', 'Corporate', 'Version A');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000003b2', true);

-- Expected: zero. User B cannot read User A resume versions.
select count(*) as user_a_resumes_visible_to_user_b
from public.resumes
where user_id = '00000000-0000-4000-8000-0000000003a1';

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

-- Expected: zero. Anonymous users cannot read resume versions.
select count(*) as resumes_visible_to_anonymous from public.resumes;

reset role;
rollback;
