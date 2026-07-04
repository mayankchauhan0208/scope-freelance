# RoleDesk

**Build your resume. Find better roles. Apply with confidence.**

RoleDesk is a private career command center for ATS resumes, job search, freelance opportunities, smart drafts, email preparation, and opportunity tracking.

RoleDesk is currently in public beta. Features are improving, every generated draft needs manual review, and RoleDesk never sends or applies automatically.

Live beta: https://mayankchauhan0208.github.io/scope-freelance/

## MVP status

Working now:

- auth-aware public landing page and private signed-in workspace
- Supabase beta signup, login, password recovery, per-user cloud sync, and RLS
- local resume parsing, profile extraction, ATS scoring, and ATS-friendly drafts
- permitted live feeds from Remotive and Arbeitnow
- guided official searches for LinkedIn, Naukri, Indeed, Upwork, Contra, Fiverr, Freelancer, Behance, and Dribbble
- safe manual opportunity import with URL validation
- local rule-based Smart Draft Mode for proposals, email, form answers, and follow-ups
- database-backed exact-draft approval before Gmail compose handoff
- tracker views, analytics, manual communication states, timeline, and in-app follow-up reminders

Smart Draft Mode is deterministic local logic, not a hosted LLM. It requires no AI key and never claims to be an external AI provider.

Not implemented: Gmail OAuth or inbox monitoring, an external AI gateway, auto-send, auto-apply, portal scraping, payment processing, PDF/DOCX resume export, or automatic reminders outside the app.

## Safety contract

RoleDesk never auto-applies, auto-sends email, auto-submits forms, auto-bids, signs contracts, accepts work, contacts clients, or makes final decisions. Every proposal, email, reply, negotiation message, application, bid, and form answer stays editable and requires the user's manual review. Nothing leaves silently.

## Data model

- Resume files are parsed in the browser.
- Before sign-in, browser storage is temporary local state.
- After sign-in, Supabase is the source of truth and local storage is a replaceable cache.
- Existing `scope-*` keys remain supported for compatibility.
- Legacy data is preserved in `scope-legacy-recovery-v1` and imported only by explicit user action.
- Private user rows are protected by Supabase Auth and RLS.

## Database setup

Back up existing tables, then apply migrations in order:

1. `supabase/migrations/001_scope_v2.sql`
2. `supabase/migrations/002_security_data_foundation.sql`
3. `supabase/migrations/003_resume_profile_ats_builder.sql`
4. `supabase/migrations/004_email_communication_tracking.sql`
5. `supabase/migrations/005_tracker_analytics_followups.sql`
6. `supabase/migrations/006_public_beta_feedback.sql`
7. `supabase/migrations/007_beta_operations_admin.sql`

Migration 002 enforces beta access, owner isolation, append-only logs, automatic approval revocation, and RPC-only draft approval. Its `approve_draft` function uses `extensions.digest(...)`, matching the production digest patch.

Migrations 003–005 add resume versioning, supervised email events, tracker follow-up fields, expanded pipeline statuses, and an owner-checked tracker event RPC. Migration 006 adds the RLS-protected beta feedback table. Migration 007 adds the server-verified Beta Operations allowlist, admin RPCs, and feedback review statuses. They do not rename existing tables.

## Local development

```powershell
python -m http.server 8766
```

Open `http://127.0.0.1:8766/`.

Run all JavaScript checks:

```powershell
node --check app.js
node --check supabase-sync.js
node --check resume-builder.js
node --check smart-engine.js
node --check portal-center.js
node --check email-desk.js
node --check tracker-engine.js
node --test tests/*.test.mjs
```

Run the SQL checks in `supabase/tests/` only against a non-production test project with the documented fixtures. See [MVP test checklist](docs/MVP_TEST_CHECKLIST.md).

## Deployment

GitHub Pages deploys reviewed `main` commits to `https://mayankchauhan0208.github.io/scope-freelance/`. The future intended domain is `roledesk.in`, but no `CNAME`, OAuth redirect, or production-domain configuration is included.

See [deployment readiness](docs/DEPLOYMENT.md), [beta operations](docs/BETA_OPERATIONS.md), [MVP test checklist](docs/MVP_TEST_CHECKLIST.md), [release notes](docs/RELEASE_NOTES.md), and [security policy](SECURITY.md).

## Secrets

The Supabase URL and publishable/anon key are public client configuration only when RLS is correctly enabled. Never commit a Supabase `service_role` key, OpenAI key, OAuth client secret, access/refresh token, Gmail credential, marketplace credential, private resume, database backup, or production export.
