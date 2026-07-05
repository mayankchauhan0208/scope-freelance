# RoleDesk customer readiness checklist

## Public access

- [x] Migration 008 is applied and its trigger state is verified in production.
- [ ] Any valid email can create and confirm an account.
- [x] Production and development redirect URLs match `docs/DEPLOYMENT.md`.
- [x] Owner-isolation and anonymous-denial SQL checks pass; an authenticated UI smoke remains pending after the email-rate-limit cooldown.

## Resume analysis

- [x] Name, email, phone, location, LinkedIn, portfolio, and GitHub extraction has fixture coverage.
- [x] Missing values remain visibly missing.
- [x] The seven ATS categories total 100 and show their contribution.
- [x] The top five fixes and confidence level are exposed for review.

## Universal search and workflow

- [x] Search Intent is generated from the reviewed profile and remains editable.
- [x] Unrelated job families and wrong seniority are penalized.
- [x] Live, guided, official-career, and manual routes are labeled honestly.
- [x] Application Packet shows evidence, concerns, missing data, and a real route.
- [x] Email, proposal, form, apply, and follow-up actions remain manual.

## Current limitations

- Live coverage is limited to permitted public feeds.
- Guided portals may require the user to sign in and search manually.
- Resume parsing and drafts use deterministic local rules, not an external LLM.
- Complex PDF layouts may require pasted text and manual correction.
- No Gmail OAuth, inbox monitoring, auto-send, auto-apply, payments, or restricted scraping exists.
- A fresh end-to-end signup/login smoke must be repeated after Supabase's current email-rate-limit cooldown.
