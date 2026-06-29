# Scope

Scope is a private, approval-first command center for freelance projects, remote jobs, direct clients, proposals, pricing, outreach, and application tracking.

## What it does

- Reads PDF, DOCX, TXT, and pasted-text résumés locally in the browser
- Detects skills and recommends target roles
- Builds focused searches for LinkedIn, Upwork, Contra, Freelancer, PeoplePerHour, remote boards, startups, and direct clients
- Retrieves real listings from permitted Remotive and Arbeitnow APIs, then ranks the complete description
- Detects public contact emails and prepares a tailored pitch draft
- Opens the official application route and prepares draft answers for pasted form questions
- Scores opportunities using skill fit, portfolio relevance, budget, client credibility, competition, deadline, long-term potential, and payment safety
- Detects risky briefs, unpaid tests, unrealistic deadlines, low budgets, off-platform pressure, and unlimited revisions
- Generates proposal and follow-up drafts
- Calculates fixed, hourly, retainer, rush, revision, and milestone pricing in USD and INR
- Opens Gmail drafts only after explicit recipient/message approval
- Tracks opportunities through the complete saved-to-paid workflow and exports CSV
- Installs as a PWA and works with cached assets after the first visit
- Includes a Chrome/Edge companion scaffold that scans application forms and fills reviewed drafts without submitting

## Run locally

From this directory:

```powershell
python -m http.server 8765
```

Open `http://127.0.0.1:8765`.

## Deploy to GitHub Pages

This repository includes `.github/workflows/deploy-pages.yml`.

1. Push the repository to a GitHub repository with `main` as the default branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Run the **Deploy Scope to GitHub Pages** workflow or push to `main`.

## Data and integrations

The public build is intentionally static. Data is stored per browser/device; it is not synchronized between devices. Gmail credentials and private API secrets are never embedded in the site.

True cross-device synchronization requires a user-owned database such as Supabase. Direct Gmail sending from the website requires a user-owned Google Cloud OAuth application and a secure backend. Until those are configured, Email Desk uses an approval-gated Gmail compose handoff.

The V2 backend contract, integration boundaries, owner requirements, and approval state machine are documented in [`docs/V2_ARCHITECTURE.md`](docs/V2_ARCHITECTURE.md). The initial Supabase schema is in [`supabase/migrations/001_scope_v2.sql`](supabase/migrations/001_scope_v2.sql), and the safe form-filling companion is in [`extension/`](extension/).

All scores are decision support, not guarantees. Scope never applies, bids, accepts work, or sends mail automatically.
