# RoleDesk

**Build your resume. Find better roles. Apply with confidence.**

RoleDesk is a private career command center for ATS-friendly resumes, job search, freelance opportunities, application drafts, and opportunity tracking. The intended MVP domain is `roledesk.in`; no domain or deployment configuration is included yet.

## Current release state

- Remotive and Arbeitnow provide permitted live job data.
- Portal Center labels Remotive and Arbeitnow as live public APIs; LinkedIn, Naukri, Indeed, Upwork, Contra, Fiverr, Freelancer, Behance, and Dribbble remain guided official links.
- Company careers, job URLs, client briefs, and freelance leads use manual import with URL validation and local Smart Engine ranking.
- Resume parsing, profile completeness, rule-based ATS scoring, ATS-friendly resume generation, opportunity ranking, truth warnings, and editable proposal/email templates run locally through RoleDesk Smart Engine.
- Supabase provides beta access, authentication, per-user data, RLS, cloud sync, and database-backed draft approval.
- OpenAI-backed drafting, Gmail monitoring/sending, automated applications, and PDF/DOCX resume export are not implemented.

Smart Draft Mode is deterministic and template-based. It does not call an external model, requires no AI key, and keeps every generated output editable and subject to manual review.

Portal status currently comes from a static registry. The existing `portal_connections` table is reserved for future backend-managed connection metadata; the browser does not write tokens, passwords, API keys, or OAuth secrets to it.

## Safety contract

RoleDesk never auto-applies, auto-sends email, auto-submits forms, auto-bids, accepts contracts, signs anything, contacts clients, or makes final decisions. Every email, proposal, form answer, reply, negotiation message, application, bid, or outreach message remains a draft until the user manually reviews and approves it. Nothing leaves the system silently.

## Local and cloud data

- Uploaded resume files are parsed in the browser.
- PDF and DOCX extraction libraries are bundled locally.
- Before sign-in, `localStorage` is temporary browser state.
- After sign-in, Supabase is the source of truth and browser storage is a replaceable cache.
- Existing `scope-*` keys remain supported for compatibility.
- Legacy data is copied into `scope-legacy-recovery-v1` and imported only after an explicit user action.

## Database setup

Apply migrations in order:

1. `supabase/migrations/001_scope_v2.sql`
2. `supabase/migrations/002_security_data_foundation.sql`
3. `supabase/migrations/003_resume_profile_ats_builder.sql`

Migration 002 is additive and does not delete existing user data. It provides owner-isolated tables, beta access, append-only activity logs, approval protection, and these controlled RPCs:

- `approve_draft(draft_id)`
- `revoke_draft_approval(draft_id, reason)`

Authenticated users cannot directly update approval columns. Editing important draft content automatically revokes approval.

Migration 003 adds user-owned resume version fields for original text, extracted facts, ATS score, issues, generated text, tone, target role, and version name. Existing resume rows and table names remain unchanged.

## Browser extension

The RoleDesk Application Companion uses temporary `activeTab` access only after the user clicks **Scan form**. Every answer requires field-level review. It never fills passwords, uploads, checkboxes, radios, or submit controls, and it never submits forms.

## Run locally

```powershell
python -m http.server 8766
```

Open `http://127.0.0.1:8766/`.

## Checks

```powershell
node --test tests/phase1-security.test.mjs tests/phase15-quality.test.mjs
```

Run `supabase/tests/phase1_rls_checks.sql` against a non-production Supabase project when possible. It rolls back its test records.

## Secrets

The Supabase project URL and publishable/anon key may be public only when RLS is correctly enabled. Never expose a Supabase `service_role` key, OpenAI API key, OAuth client secret, refresh token, marketplace credential, Gmail credential, private resume, or production export.

See [SECURITY.md](SECURITY.md) for the complete boundary.
