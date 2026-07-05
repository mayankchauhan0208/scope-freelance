# RoleDesk

**Build your resume. Find better roles. Apply with confidence.**

RoleDesk is a private career command center for ATS resumes, job search, freelance opportunities, smart drafts, email preparation, and opportunity tracking.

RoleDesk is currently in controlled beta. Production migration 008 is applied, so `beta_access` no longer gates normal customer signup, but public confirmation email delivery still requires custom SMTP. Every generated draft needs manual review, and RoleDesk never sends or applies automatically.

Live beta: https://mayankchauhan0208.github.io/scope-freelance/

## MVP status

Working now:

- auth-aware public landing page and private signed-in workspace
- lightweight eight-step first-run onboarding with skip, progress, next-action, and application-workflow controls
- public Supabase signup, login, password recovery, per-user cloud sync, and owner-only RLS
- multi-industry resume parsing, reviewed profile extraction, transparent 100-point ATS scoring, and ATS-friendly drafts
- permitted live feeds from Remotive and Arbeitnow
- guided official searches for LinkedIn, Naukri, Indeed, Upwork, Contra, Fiverr, Freelancer, Behance, and Dribbble
- safe manual opportunity import with URL validation
- local rule-based Smart Draft Mode for proposals, email, form answers, and follow-ups
- database-backed exact-draft approval before Gmail compose handoff
- tracker views, analytics, manual communication states, timeline, and in-app follow-up reminders
- real user-specific dashboard metrics with honest empty states; sample opportunities appear only after **Load demo data**, stay labeled, and are excluded from sync and analytics
- universal resume-based search with editable Search Intent, multi-industry role taxonomy, role/seniority/skill clusters, explainable ranking, deduplication, and unrelated-family penalties
- Opportunity Coverage Engine with a structured source registry, profile-supported role clusters, guided searches, MNC Career Directory, weekly coverage checklist, Manual Import 2.0, application-route detection, Application Packets, and a truth-aware Form Answer Kit
- admin-only beta feedback triage with honest priorities, aggregate-only launch metrics, existing-status workflow labels, and a first-week issue checklist

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
8. `supabase/migrations/008_public_customer_access.sql`
9. `supabase/migrations/009_public_beta_activation.sql`

Migration 002 enforces beta access, owner isolation, append-only logs, automatic approval revocation, and RPC-only draft approval. Its `approve_draft` function uses `extensions.digest(...)`, matching the production digest patch.

Migrations 003–005 add resume versioning, supervised email events, tracker follow-up fields, expanded pipeline statuses, and an owner-checked tracker event RPC. Migration 006 adds the RLS-protected beta feedback table. Migration 007 adds server-verified admin operations. Migration 008 removes the beta signup gate and safely bootstraps a minimal profile. Migration 009 adds launch feedback categories and an admin-only aggregate metrics RPC. They do not weaken owner RLS or rename existing tables.

## Customer workflow

Create an account, review the extracted resume profile, run the transparent ATS analysis, edit Search Intent, search or import opportunities, review match evidence, prepare an Application Packet, copy/open drafts manually, mark applications manually, and schedule follow-ups. Live feeds are limited to permitted public sources; LinkedIn, Naukri, Indeed, Upwork, and similar platforms remain guided searches.

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

See [opportunity coverage](docs/OPPORTUNITY_COVERAGE.md), [deployment readiness](docs/DEPLOYMENT.md), [beta operations](docs/BETA_OPERATIONS.md), [MVP test checklist](docs/MVP_TEST_CHECKLIST.md), [release notes](docs/RELEASE_NOTES.md), and [security policy](SECURITY.md).

## Secrets

The Supabase URL and publishable/anon key are public client configuration only when RLS is correctly enabled. Never commit a Supabase `service_role` key, OpenAI key, OAuth client secret, access/refresh token, Gmail credential, marketplace credential, private resume, database backup, or production export.
