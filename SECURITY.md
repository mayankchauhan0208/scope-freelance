# RoleDesk security and privacy

## Security model

The Phase 1 branch is designed for multiple users. Supabase Auth establishes identity and row-level security isolates every user's profile, resumes, opportunities, drafts, applications, portal-connection metadata and activity logs.

Resume extraction and ATS scoring run locally. Resume text is not sent to an AI provider. Signed-in users may save resume originals and generated versions only to their own RLS-protected `resumes` rows.

RoleDesk Smart Engine is local rule-based code. It makes no external AI requests, exposes no model credentials, and never sends or submits its drafts. Signed-in users can explicitly save proposal and email drafts to their own RLS-protected `drafts` rows.

Frontend email checks are convenience validation only. They are not a security boundary.

## Beta access

New Auth users must have an active row in `public.beta_access`. Existing users are backfilled during migration 002. The allowlist is enforced by a database trigger before a new `auth.users` row is created.

Disabling the frontend signup button is not sufficient beta protection. Keep the database trigger enabled during beta.

## Local browser data

- Resume files are parsed locally.
- Signed-in Supabase data may be cached in `localStorage` for rendering.
- Supabase remains authoritative after login.
- Signing out clears the active account cache.
- Pre-Phase-1 `scope-*` data is preserved in `scope-legacy-recovery-v1` and is never imported into an account without an explicit user action.
- Clearing all browser/site data removes caches and recovery records.

Because browser storage is readable by same-origin JavaScript, Content Security Policy, output escaping and strict URL validation are required defenses.

## Service worker

The service worker caches only an explicit list of same-origin static files. It ignores:

- Supabase and all cross-origin API requests
- Requests containing an Authorization header
- Responses marked private or no-store
- Responses varying on Authorization or Cookie
- Responses that set cookies

Activation deletes obsolete caches whose names start with `scope-`, while preserving unrelated origin caches.

## Draft approvals and logs

- New drafts are forced to `draft_ready` regardless of frontend input.
- Only `approve_draft` can grant `user_approved` state.
- Only the owner can approve or revoke a draft.
- Recipient, subject, body, destination, content or opportunity changes automatically revoke approval and clear its hash.
- Approval creates a SHA-256 content hash and activity-log record.
- Frontend users cannot directly update approval columns.
- Activity logs are append-only for authenticated frontend users: owner read access only, with insertion through the controlled RPC.

These guarantees apply after migration 002 has been successfully applied.

## URLs and rendered content

Opportunity links accept only credential-free `http:` and `https:` URLs. `javascript:`, `data:`, `file:`, `vbscript:` and other schemes are rejected. Imported and API-provided text is escaped before insertion into HTML, and large text values are bounded.

The current CSP permits scripts only from the same origin and limits network connections to the configured Supabase project, Remotive and Arbeitnow.

## Extension

The companion uses temporary `activeTab` access. It does not run on every website by default. Scanning and filling are user-triggered. Every filled answer must be reviewed for a stable field identity, and the extension rechecks that identity immediately before insertion. It never submits forms.

## Secrets

Never place these in this repository, GitHub Pages, browser storage or client JavaScript:

- Supabase service-role key
- OAuth client secrets
- OAuth access/refresh tokens
- OpenAI API keys
- Gmail credentials
- Marketplace credentials
- Private production exports

Server-side integration credentials must use Supabase secrets or another managed secret store. `portal_connections.secret_reference` may contain only a backend secret reference, never the secret itself.

## Not implemented

- OpenAI integration
- Gmail OAuth, monitoring or sending
- Automated job applications
- Automated form submission
- LinkedIn or Naukri private-page scraping
- Direct Upwork ingestion without approved API access

Opening an approved Gmail compose URL is not sending. No code in the current project automatically sends mail, applies, bids, signs, accepts or submits.
