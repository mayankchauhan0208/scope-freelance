# RoleDesk architecture

## Current MVP

- Static GitHub Pages-compatible frontend for all review and editing workflows.
- Supabase Auth and Postgres for beta access, private user data, RLS, drafts, approvals, and append-only activity.
- Bundled browser libraries for local PDF/DOCX text extraction.
- Local rule-based Smart Draft Mode for ranking, ATS analysis, proposals, email drafts, form answers, and follow-ups.
- Remotive and Arbeitnow as permitted live public feeds.
- Guided official links and manual import for restricted or non-integrated sources.
- Browser companion with temporary `activeTab` access and user-reviewed form insertion; it never submits.

## Approval boundary

`draft_ready → user_approved → manual external action`

Editing recipient, subject, body, destination, content, or opportunity revokes approval. RoleDesk never performs the final Send, Apply, Submit, Bid, Accept, or Sign action.

## Future architecture—not implemented

- A server-side external AI gateway may provide richer drafts. Keys must remain in a managed backend secret store.
- A Gmail OAuth backend may read permitted metadata and prepare drafts. Tokens must never enter the public frontend.
- Approved portal APIs may expand live ingestion. LinkedIn, Naukri, and Upwork remain guided-only in the MVP.
- No roadmap integration changes the draft-first and approval-first product contract.

See `DEPLOYMENT.md`, `GMAIL_OAUTH_FUTURE.md`, and `../SECURITY.md` before production configuration.
