# RoleDesk deployment readiness

## Release strategy

- Review branch: `codex/smart-opportunity-engine`
- Merge target after approval: `main`
- GitHub Pages source after merge: deploy from `main` at repository root, or use a reviewed Pages workflow
- Current live URL: `https://mayankchauhan0208.github.io/scope-freelance/`
- Local URL: `http://127.0.0.1:8766/`
- Future intended domain: `roledesk.in` (not configured)

Do not add a `CNAME` or change production redirect URLs until the domain is purchased and confirmed.

## GitHub Pages checklist

- [ ] Review and approve this branch
- [ ] Confirm all tests and manual smoke checks pass
- [ ] Merge through a reviewed pull request
- [ ] Set Pages source to the approved branch/root or reviewed workflow
- [ ] Confirm HTTPS is enabled
- [ ] Open the Pages URL in a clean browser profile
- [ ] Confirm assets, PWA manifest, and service worker load from the repository subpath
- [ ] Confirm no `.env`, backups, private exports, or generated `pdf/` files are published

## Supabase checklist

- [ ] Back up current tables
- [ ] Apply migrations 001 through 009 in order
- [ ] Confirm `approve_draft` uses `extensions.digest(...)`
- [ ] Confirm public email signup is enabled; use `beta_access` only for optional cohorts
- [ ] Configure a production custom SMTP provider before opening signup publicly
- [ ] Raise the auth email rate limit only after custom SMTP is active
- [ ] Confirm RLS is enabled on every user-owned table
- [ ] Configure Site URL and allowed redirect URLs for the exact GitHub Pages URL
- [ ] Keep localhost redirect URLs only when needed for development
- [ ] Test signup confirmation, login, logout, and password recovery
- [ ] Confirm anonymous access is blocked
- [ ] Confirm user A cannot read or modify user B data
- [ ] Confirm approval cannot be directly edited and content changes revoke approval
- [ ] Confirm activity logs are owner-readable and append-only
- [ ] Confirm legacy `scope-*` recovery and explicit import work
- [ ] Confirm the service worker never caches Supabase or authenticated responses

## Required client configuration

Only the Supabase project URL and publishable/anon key belong in `supabase-config.js`. `service_role`, OAuth secrets, external AI keys, Gmail tokens, and portal credentials must remain server-side and must never be added to GitHub Pages.

## Redirect URLs

Confirm these values in **Supabase → Authentication → URL Configuration**:

- Site URL: `https://mayankchauhan0208.github.io/scope-freelance/`
- Redirect URL: `https://mayankchauhan0208.github.io/scope-freelance/`
- Redirect URL: `https://mayankchauhan0208.github.io/scope-freelance/**`
- Redirect URL: `http://127.0.0.1:8766/`
- Redirect URL: `http://localhost:8766/`

Do not use `localhost:3000` for the production reset flow. Supabase's built-in mailer is limited to two messages per hour and is not suitable for public customer email delivery. Configure custom SMTP, then set a provider-appropriate auth email limit before declaring the product ready for public signup. The UI converts rate-limit responses to a clear wait message.

Do not add `roledesk.in` until it is configured and serving the app. Do not change Google or other OAuth URLs because Gmail OAuth is not implemented.

## Rollback

If the static release fails, disable Pages or restore the previous reviewed commit. Database migrations are additive; take a backup before applying them and investigate failed preflight checks rather than deleting data or weakening RLS.
