-- Run after migration 005 in a non-production test project.
begin;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a1',true);

-- User A can update only their own tracker row under the existing owner RLS policy.
update public.opportunities
set next_followup_at = now() + interval '2 days',
    followup_reason = 'Test follow-up',
    followup_status = 'scheduled'
where id = '10000000-0000-4000-8000-0000000000a1'
  and user_id = '00000000-0000-4000-8000-0000000000a1';

-- Expected: zero rows visible for another owner.
select count(*) as other_user_rows_visible
from public.opportunities
where user_id <> '00000000-0000-4000-8000-0000000000a1';

-- Expected: error. Direct activity log inserts remain forbidden.
-- insert into public.activity_logs (user_id,event_type,entity_type)
-- values ('00000000-0000-4000-8000-0000000000a1','email.sent','opportunity');

-- Expected: error. Authoritative events are not accepted by the tracker RPC.
-- select public.record_tracker_client_event('https://example.test/a','email.sent','{}'::jsonb);

rollback;
