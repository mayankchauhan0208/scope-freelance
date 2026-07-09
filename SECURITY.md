# RoleDesk security and privacy

Phase 28 onboarding data stores progress, career goals, notification preferences, demo-mode state, and onboarding events behind owner-only RLS, with admin access limited to aggregate review through server-checked admin RPCs. Onboarding analytics must not store private resume text or draft bodies. Phase 27 billing data is split between public plan metadata, owner-visible subscription/usage rows, admin-only plan controls, and protected webhook logs. Normal users cannot edit plan overrides, provider IDs, usage counters, webhook events, or subscription status directly. Payment integration is not active yet; checkout records stay `not_configured` until a trusted provider integration and signature-verified webhook are added. Phase 26 admin analytics store product events, source health, error logs, referral events, feature requests, and admin notes behind RLS. Admin views show aggregate/user-activation summaries only and do not expose private resume text, drafts, application assets, authentication secrets, or provider tokens. Phase 25 Application Kit drafts and Phase 23 Career Agent recommendations are advisory and generated locally from reviewed user data. Career targets, daily plans, recommendations, resume variants, application kits, generated application assets, export history, outcome feedback, interview preparation, notifications, reminder settings, and calendar-ready events require authentication and owner-only RLS. Resume variants and application assets reuse verified facts and remain unreviewed until the user checks them. Notification, calendar, and export tables are storage foundations only; RoleDesk does not send notifications, alter external calendars, auto-send, auto-submit, or auto-apply.

## Security model

The Phase 1 branch is designed for multiple users. Supabase Auth establishes identity and row-level security isolates every user's profile, resumes, opportunities, drafts, applications, portal-connection metadata and activity logs.

Resume extraction and ATS scoring run locally. Resume text is not sent to an AI provider. Signed-in users may save resume originals and generated versions only to their own RLS-protected `resumes` rows.

Beta feedback is stored in `public.feedback`. Anonymous and authenticated users may insert a bounded feedback message; authenticated users may read only rows owned by their user ID. Client roles cannot update or delete feedback, and there is no public policy for reading all feedback.

Beta administrators are stored in the RLS-protected `public.admin_users` allowlist. The browser asks the `is_roledesk_admin` RPC whether the signed-in JWT email is active; hiding the navigation is only presentation, while database RLS and security-definer RPC checks enforce every privileged read and write. Admins can review feedback, source health, error logs, aggregate analytics, beta access, billing summaries, plan assignments, and internal notes, but the panel does not expose passwords, Auth secrets, resumes, drafts, applications, application asset text, payment credentials, webhook signing secrets, or service credentials.

RoleDesk Smart Engine is local rule-based code. It makes no external AI requests, exposes no model credentials, and never sends or submits its drafts. Signed-in users can explicitly save proposal and email drafts to their own RLS-protected `drafts` rows.

Portal Center uses permitted public feeds, official guided links, and manual imports only. Restricted portals are not scraped or automated. Imported source/apply URLs must pass the shared HTTP/HTTPS validator, and no portal credentials or OAuth tokens are stored in browser-readable metadata.

Job source trust data uses permitted public-feed metadata, user reports, and owner-scoped verification records. RoleDesk does not scrape restricted platforms or guess email addresses. Application Kit outputs are editable drafts with truth warnings; cloud-saved kits, assets, export history, and content quality scores are owner-scoped.

Email Desk opens a prefilled Gmail compose URL only after database-backed approval of the exact recipient, subject, and body. It never sends mail. Manual sent/reply statuses are labeled `user_reported` and `provider_confirmed: false`. Future Gmail OAuth tokens must remain server-side as described in `docs/GMAIL_OAUTH_FUTURE.md`.

Tracker follow-ups are in-app records only. Migration 005 adds user-scoped follow-up fields and an owner-checked RPC with a narrow event allowlist. It cannot create authoritative `email.sent`, application submission, payment, or approval events.

Frontend email checks are convenience validation only. They are not a security boundary.

## Beta access

Migration 008 enables public customer signup by removing the old `beta_access` trigger. `beta_access` remains optional for cohort notes and beta operations; it is not an authorization boundary for the normal workspace. `admin_users` plus the server-verified `is_roledesk_admin` RPC remain the admin boundary.

Every private workspace table keeps owner-only RLS. Public signup does not grant cross-user reads, admin access, draft-approval mutation, or activity-log mutation. The `handle_new_user` trigger creates only a minimal profile row and cannot expose resume content.

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
- `approve_draft` uses `extensions.digest(...)`; the extension schema is explicit and does not depend on a mutable caller search path.
- Frontend users cannot directly update approval columns.
- Activity logs are append-only for authenticated frontend users: owner read access only, with insertion through the controlled RPC.

These guarantees apply after migrations 002-016 have been successfully applied where relevant.

## Opportunity pipeline and delivery evidence

Migration 010 keeps opportunity contacts owner-scoped with a composite ownership foreign key. The manual application RPC resolves an opportunity by both `auth.uid()` and its source URL, records the application as user-reported, and never claims an external submission occurred automatically.

`email_delivery_logs` is owner-readable but cannot be inserted, updated, or deleted by browser users. Only a future trusted backend/provider webhook may record provider delivery, bounce, or failure evidence. Client events such as compose opened or marked sent remain explicitly `provider_confirmed: false`.

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
- External AI gateway
- Gmail OAuth, monitoring or sending
- Automated job applications
- Automated form submission
- LinkedIn or Naukri private-page scraping
- Direct Upwork ingestion without approved API access

Opening an approved Gmail compose URL is not sending. No code in the current project automatically sends mail, applies, bids, signs, accepts or submits.
