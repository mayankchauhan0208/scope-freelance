# RoleDesk beta operations

## Add or disable beta access

`beta_access` is optional after migration 008. Any valid email may create a normal customer workspace. Use this table only for named cohorts, invite notes, or controlled beta operations; it does not grant admin access.

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

Admins can filter feedback and use the visible workflow labels **New**, **Reviewed**, **In Progress**, **Needs More Info**, **Fixed**, **Rejected**, **Duplicate**, **Won't fix now**, or **Planned** in **Product Operations**. Phase 26 stores browser/device context for debugging, error logs, source-health checks, aggregate funnel events, and internal notes behind admin-only RLS. The panel derives a Critical, High, Medium, or Low priority from the submitted type and blocker words. It is a triage aid, not an automated decision.

The first-week checklist groups real feedback into ten categories: login/reset, resume identity extraction, ATS output, search quality, apply links, application packets, proposal/email drafts, tracker/follow-ups, mobile layout, and Supabase sync. Counts remain zero until submitted feedback matches a category.

Normal signed-in users can read only their own feedback, anonymous users cannot read feedback, and only an admin-verified RPC can change review status. Admin analytics never show private resume text, draft bodies, application asset text, passwords, or provider credentials.

## Deployment rollback

GitHub Pages deploys from `main`. If a release fails, revert its commit on `main`, push the revert, and wait for the Pages workflow. Database migrations are additive and separate: do not run destructive rollback SQL. Disable the feedback UI through a reviewed static revert if needed while preserving submitted rows.

## Safety and secrets

RoleDesk is not an employer and does not guarantee jobs. It does not submit applications, send emails automatically, or scrape restricted platforms. Drafts may need correction; users must verify every claim before use.

Never expose a Supabase `service_role` key, database password, OpenAI key, OAuth client secret, Gmail token, marketplace credential, private key, production backup, resume, or client-confidential content. Only the Supabase URL and publishable client key belong in the static app, protected by RLS. Admins cannot see user passwords, authentication tokens, private resumes, drafts, or applications through the Beta Operations panel.

## One-week operating mode

For the next week, avoid major feature development, paid APIs, Gmail OAuth, and complex integrations. Use RoleDesk daily, log issues through **Send beta feedback**, and fix only high-priority blockers or live usability bugs with small, safe changes. Invite 2–5 beta users, review feedback after seven days, and then choose the next feature phase from real usage.

### Mayank's daily RoleDesk workflow

1. Sign in.
2. Check profile completeness.
3. Search two or three role clusters.
4. Open guided searches.
5. Check five to ten MNC career pages.
6. Save useful opportunities.
7. Generate application packets.
8. Prepare and review drafts.
9. Mark applications manually.
10. Schedule follow-ups.
11. Submit feedback when something breaks.

### Fix priority

- **Critical:** privacy/security exposure, approval bypass, or sign-in/reset blocked.
- **High:** profile/save/sync, identity, application packet, Email Desk safety, Tracker, or mobile use blocked.
- **Medium:** confusing workflow, poor match, resume output, or draft-quality issue with a workaround.
- **Low:** feature request or cosmetic issue that does not block the beta workflow.

Do not build Gmail OAuth, external AI, payments, auto-send, auto-apply, or restricted-platform scraping during this sprint.
