# RoleDesk MVP test checklist

## Automated checks

- [ ] JavaScript syntax checks pass
- [ ] All `tests/*.test.mjs` checks pass
- [ ] Secret value scan passes
- [ ] Browser desktop smoke check passes with no console errors
- [ ] Mobile viewport smoke check passes
- [ ] Phase 1, 1.5, 3, 4, 5, 6, 7, and 8 checks pass

## Supabase checks

- [ ] Migration 006 is applied after migrations 001–005 and a current backup exists
- [ ] Migrations 001–005 are applied in order after backup
- [ ] Beta allowlist accepts invited email and rejects uninvited signup
- [ ] Signup confirmation, login, logout, and password reset work
- [ ] Anonymous users cannot read user tables
- [ ] User A cannot access user B profile, resumes, opportunities, drafts, applications, or logs
- [ ] Draft approval cannot be faked by direct update
- [ ] Editing approved content revokes approval
- [ ] Activity logs cannot be updated or deleted by frontend users
- [ ] Logout clears active browser cache; login restores cloud data

## Product smoke checks

- [ ] Dashboard and setup checklist load
- [ ] Resume parsing and reviewed profile save work
- [ ] ATS resume generation, copy, text/Markdown export, and cloud save work
- [ ] Smart Search labels live, guided, and manual sources honestly
- [ ] Manual import validates URL and saves to Tracker
- [ ] Proposal Studio creates an editable local Smart Draft
- [ ] Email Desk cannot open Gmail before exact database approval
- [ ] Gmail compose handoff does not send mail
- [ ] Tracker views, status persistence, filters, analytics, and timeline work
- [ ] Follow-up schedule, complete, snooze, and draft actions work
- [ ] Beta feedback submits and remains private to its owner
- [ ] No automatic send, apply, submit, bid, sign, or contract action exists

Run SQL checks in `supabase/tests/` against a non-production test project. Some scripts expect the Phase 1 fixture users and rows documented in the test SQL.
