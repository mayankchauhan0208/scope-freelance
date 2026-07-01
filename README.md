# Scope

Scope is the current development name for an approval-first career opportunity workspace. The product is being prepared as a multi-user SaaS application; the full **Your Career** rebrand is intentionally deferred until Phase 2.

## Current release state

- `main` is the original local-first public build.
- `codex/smart-opportunity-engine` contains the Phase 1 Supabase and security foundation.
- Remotive and Arbeitnow provide permitted live job data.
- LinkedIn, Naukri, Upwork and other restricted platforms use guided links unless approved API access is available.
- OpenAI-backed drafting, Gmail monitoring, automated applications and automatic sending are not implemented.

## What remains local

- The uploaded resume file is parsed in the browser.
- PDF and DOCX extraction libraries are bundled locally.
- Demo opportunities, pricing calculations and heuristic scoring run locally.
- Before sign-in, `localStorage` is temporary browser state only.
- Existing `scope-*` data is copied into `scope-legacy-recovery-v1` before the active cache is cleared. Import requires an explicit click after sign-in.

## What uses Supabase on the Phase 1 branch

- Email/password signup, login, logout and password recovery
- Beta access enforcement using `beta_access`
- Per-user profiles and resume data
- Per-user opportunities
- Database-backed drafts and approval RPCs
- Applications and portal-connection metadata schema
- Append-only activity logs
- Multi-user isolation through Supabase Auth and RLS

After login, Supabase is the source of truth. Browser storage is a replaceable cache and legacy-recovery location.

## Database setup

Apply migrations in order:

1. `supabase/migrations/001_scope_v2.sql`
2. `supabase/migrations/002_security_data_foundation.sql`

Migration 002 is additive and does not delete existing user data. Existing Auth users are automatically added to the beta allowlist.

To invite a new beta email, run from the Supabase SQL editor using an administrator session:

```sql
insert into public.beta_access (email, note)
values ('invited-user@example.com', 'Private beta invite')
on conflict (email) do update set active = true, expires_at = null;
```

The `beta_access` table has RLS enabled and no browser-readable policy. Never build a public frontend screen that writes directly to it.

Configure Supabase Auth URL settings with the exact local and GitHub Pages URLs used by the application so email confirmation and password recovery return safely.

## Approval guarantees

The Phase 1 migration adds:

- `approve_draft(draft_id)`
- `revoke_draft_approval(draft_id, reason)`
- `create_activity_log(event_type, entity_type, entity_id, metadata)`

Authenticated users cannot directly update draft approval columns. A database trigger automatically revokes approval when recipient, subject, body, destination, content or opportunity changes. Activity logs can be read by their owner but cannot be directly inserted, updated or deleted from the frontend.

Opening Gmail creates a compose window only. It does not send the message. Scope never clicks Apply, Submit, Bid, Accept, Sign or Send.

## Browser extension safety

The companion extension has no persistent access to every website. `activeTab` and `scripting` are used only after the user clicks **Scan form**. Every answer requires an explicit field-level review checkbox. Fields are re-identified before filling, and changed fields are skipped. Passwords, file uploads, checkboxes, radios and submit controls are never filled.

## Run locally

```powershell
python -m http.server 8766
```

Open `http://127.0.0.1:8766/`.

## Checks

Run the static Phase 1 security checks:

```powershell
node --test tests/phase1-security.test.mjs
```

Run `supabase/tests/phase1_rls_checks.sql` in a non-production Supabase project when possible. The SQL test uses a transaction and rolls back its test records.

## Secrets

Safe in public frontend code:

- Supabase project URL
- Supabase publishable/anon key, when RLS is correctly enabled

Never expose or commit:

- Supabase `service_role` key
- OpenAI API keys
- Google OAuth client secrets or refresh tokens
- Upwork client secrets
- Gmail credentials
- Private resumes or exported production data

See [SECURITY.md](SECURITY.md) for the complete boundary.
