-- Fail-closed emergency rollback for migration 002.
-- This preserves user data, owner RLS, approval guards, and trusted audit RPCs.
begin;

-- Beta signup enforcement may be disabled independently during recovery.
drop trigger if exists enforce_beta_access_before_signup on auth.users;
drop function if exists public.enforce_beta_access();

-- A generic client logger must never survive rollback.
drop function if exists public.create_activity_log(text, text, uuid, jsonb);
revoke insert, update, delete on public.activity_logs from authenticated;

-- Fail closed: retain the approval trigger and approve/revoke RPCs, while
-- explicitly preventing direct edits to approval columns.
revoke update on public.drafts from authenticated;
grant update (opportunity_id, kind, destination, content, recipient, subject, body)
  on public.drafts to authenticated;

-- New tables, ownership constraints, RLS policies, updated_at triggers,
-- guard_draft_approval, approve_draft, and revoke_draft_approval remain in place.
-- Removing them would weaken isolation or make existing approvals forgeable.
commit;
