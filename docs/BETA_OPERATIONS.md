# RoleDesk beta operations

## Add or disable beta access

In Supabase SQL Editor, add an invited email with a safe upsert:

```sql
insert into public.beta_access (email, note, active)
values ('user@example.com', 'Public beta invite', true)
on conflict (email) do update
set active = true, expires_at = null, note = excluded.note;
```

Disable access without deleting history:

```sql
update public.beta_access
set active = false
where email = 'user@example.com';
```

Existing authenticated sessions may remain valid until they sign out or expire. Use **Authentication → Users** in Supabase to review accounts and revoke a session when necessary.

## Beta Operations panel

Active rows in `public.admin_users` can open **Beta Operations** after signing in. The navigation is hidden for everyone else, and the underlying reads and writes remain blocked by RLS and server-verified RPCs. The panel can add, activate, deactivate, annotate, or expire beta access; it never exposes passwords or Auth secrets.

Use the **Invite Copy** card to add the tester's name and copy a reviewed invitation containing the live URL. RoleDesk never sends this message automatically. Add the email to beta access before sharing the invite.

## Review feedback

Admins can filter feedback and mark it `new`, `reviewed`, `planned`, `fixed`, or `archived` in **Beta Operations**. Normal signed-in users can read only their own feedback, anonymous users cannot read feedback, and only an admin-verified RPC can change review status.

## Deployment rollback

GitHub Pages deploys from `main`. If a release fails, revert its commit on `main`, push the revert, and wait for the Pages workflow. Database migrations are additive and separate: do not run destructive rollback SQL. Disable the feedback UI through a reviewed static revert if needed while preserving submitted rows.

## Safety and secrets

RoleDesk is not an employer and does not guarantee jobs. It does not submit applications, send emails automatically, or scrape restricted platforms. Drafts may need correction; users must verify every claim before use.

Never expose a Supabase `service_role` key, database password, OpenAI key, OAuth client secret, Gmail token, marketplace credential, private key, production backup, resume, or client-confidential content. Only the Supabase URL and publishable client key belong in the static app, protected by RLS. Admins cannot see user passwords, authentication tokens, private resumes, drafts, or applications through the Beta Operations panel.

## One-week operating mode

For the next week, avoid major feature development, paid APIs, Gmail OAuth, and complex integrations. Use RoleDesk daily, log issues through **Send beta feedback**, and fix only high-priority blockers or live usability bugs with small, safe changes. Invite 2–5 beta users, review feedback after seven days, and then choose the next feature phase from real usage.
