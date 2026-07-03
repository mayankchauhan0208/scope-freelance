# Future Gmail OAuth setup

Phase 6 uses manual Gmail compose only. It does not connect to Gmail, read mail, create Gmail drafts through an API, monitor replies, or send messages.

Future Gmail integration requires:

- A Google Cloud project controlled by the RoleDesk operator.
- Gmail API enabled in that project.
- An OAuth consent screen and verified production domain.
- Exact authorized redirect URLs for the deployed backend.
- Server-side OAuth exchange and encrypted token storage. Tokens must never reach frontend JavaScript, Supabase browser-readable rows, logs, or source control.
- A disconnect flow that revokes access and deletes stored tokens.
- Monitoring limited to threads the user explicitly chooses to track.
- Draft creation only; sending must remain a separate, explicit user action.

Future server environment names:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

These values belong only in the server secret manager. They must not be placed in `supabase-config.js`, `.env.example`, the static site, or GitHub Pages settings.
