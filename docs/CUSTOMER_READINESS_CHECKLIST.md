# RoleDesk customer readiness checklist

## Public access

- [ ] Migration 008 is applied.
- [ ] Any valid email can create and confirm an account.
- [ ] Production and development redirect URLs match `docs/DEPLOYMENT.md`.
- [ ] A normal user cannot see Beta Operations or another user's rows.

## Resume analysis

- [ ] Name, email, phone, location, LinkedIn, portfolio, and GitHub are reviewed.
- [ ] Missing values remain visibly missing.
- [ ] The seven ATS categories total 100 and show their contribution.
- [ ] The top five fixes and confidence level are understandable.

## Universal search and workflow

- [ ] Search Intent is generated from the reviewed profile and remains editable.
- [ ] Unrelated job families and wrong seniority are penalized.
- [ ] Live, guided, official-career, and manual routes are labeled honestly.
- [ ] Application Packet shows evidence, concerns, missing data, and a real route.
- [ ] Email, proposal, form, apply, and follow-up actions remain manual.

## Current limitations

- Live coverage is limited to permitted public feeds.
- Guided portals may require the user to sign in and search manually.
- Resume parsing and drafts use deterministic local rules, not an external LLM.
- Complex PDF layouts may require pasted text and manual correction.
- No Gmail OAuth, inbox monitoring, auto-send, auto-apply, payments, or restricted scraping exists.
