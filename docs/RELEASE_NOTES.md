# RoleDesk MVP release notes

RoleDesk MVP includes secure Supabase login, private profile and resume storage, an ATS resume builder, local Smart Draft Mode, permitted live job feeds, guided job and freelance searches, Portal Center, manual opportunity import, proposal and email preparation, database-backed draft approval, tracker analytics, and in-app follow-up reminders.

## Safety

Everything is draft-first and approval-first. RoleDesk does not auto-apply, auto-send, auto-submit, auto-bid, sign contracts, accept work, contact clients, or make final decisions.

## Known limitations

- Smart Draft Mode is local rule-based logic, not a full LLM.
- Gmail OAuth, inbox reading, reply monitoring, and API sending are not implemented.
- LinkedIn, Naukri, Indeed, and Upwork are guided-only.
- Search volume depends on permitted public feeds and manual imports.
- Follow-up reminders are in-app only.
- `roledesk.in` is not configured and no `CNAME` is included.
- Production release still requires migrations 001–005, Supabase redirects, beta allowlist verification, RLS tests, and an approved merge/deploy review.
