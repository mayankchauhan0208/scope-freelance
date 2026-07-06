-- Run after migration 010 in a non-production fixture project. Transactional.
begin;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

-- Expected: only User A's rows are visible.
select count(*) as other_owner_contacts_visible
from public.opportunity_contacts
where user_id <> auth.uid();

select count(*) as other_owner_delivery_logs_visible
from public.email_delivery_logs
where user_id <> auth.uid();

-- Expected: permission denied. Browsers cannot forge provider delivery evidence.
-- insert into public.email_delivery_logs (user_id,email_type,recipient,status,provider)
-- values (auth.uid(),'application','candidate@example.test','delivered','forged');

-- Expected: error when the URL is not owned by User A.
-- select public.mark_application_applied('https://example.test/not-owned','Job board',current_date + 5,'test');

rollback;
