# RoleDesk V2: supervised opportunity agent

## Product contract

RoleDesk discovers and analyzes work; the user makes every final decision.

1. External messages, proposals, applications, negotiations, and form submissions are always drafts.
2. Editing a draft revokes prior approval.
3. The user sees the destination, recipient, full content, attachments, and platform before approving.
4. RoleDesk never clicks a final Submit, Apply, Bid, Accept, Sign, or Send control automatically.
5. Every external action is recorded in an audit log.

## Architecture

- **GitHub Pages frontend:** review queue, opportunity detail, drafts, coaching, and approvals.
- **Supabase:** authentication, Postgres data, encrypted integration metadata, realtime updates, scheduled searches, and Edge Functions.
- **OpenAI Responses API:** structured extraction, ranking explanation, email/proposal/form drafting, reply classification, and negotiation coaching. Use a smaller model for high-volume extraction/ranking and the flagship model only for final high-value drafts.
- **RoleDesk browser companion:** reads the visible application form schema and fills reviewed drafts. It never submits.
- **Gmail OAuth backend:** checks permitted message metadata, associates replies with opportunities, prepares reply drafts, and waits for approval.

## Source strategy

| Source | Retrieval approach | Constraint |
|---|---|---|
| Remotive | Public API, attributed links | Cache and request conservatively |
| Arbeitnow | Public API | Remote/Europe weighted |
| LinkedIn | Guided search + browser companion | Job API access is restricted to approved partners |
| Naukri | Guided search + browser companion | No general public search API confirmed |
| Upwork | Official GraphQL API after key approval | Key, OAuth, rate/caching rules required |
| Company career pages | Browser companion or permitted ATS feeds | Same-origin browser restrictions |
| Gmail | Google OAuth backend | Never store tokens in the public frontend |

Official references:

- OpenAI models and Responses API capabilities: https://developers.openai.com/api/docs/models
- Upwork developer access: https://www.upwork.com/developer
- Upwork API documentation: https://www.upwork.com/developer/documentation/graphql/api/docs/index.html
- LinkedIn Job API access restrictions: https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview
- Remotive public API: https://support.remotive.com/en/article/list-remote-jobs-public-api-105pww2/

## Approval state machine

`discovered → analyzed → shortlisted → draft_ready → user_approved → externally_completed`

Any content or destination change after `user_approved` moves the item back to `draft_ready`.

## What is required from the owner

1. Résumé and portfolio case-study URLs.
2. Target roles, countries, minimum rates, availability, and work-type preferences.
3. A Supabase project for cross-device sync and scheduled jobs.
4. An OpenAI Platform API key stored only as a backend secret.
5. A Google Cloud OAuth client for Gmail access from the web product.
6. An approved Upwork API key for direct Upwork ingestion.
7. LinkedIn and Naukri logins remain in the user's own browser; passwords are never supplied to RoleDesk.
