# Opportunity Coverage Engine

RoleDesk helps users find where to apply, prepare what to send, and track every next step without auto-sending or auto-applying. It does not claim total internet coverage.

## Source methods

- **Live API/public feed:** only Remotive and Arbeitnow are currently fetched through permitted public endpoints.
- **Guided Search:** opens an official portal search. RoleDesk does not scrape results, automate login, bid, or submit applications.
- **Official careers:** the MNC Career Directory links to official career homepages. Users search, review, and apply manually.
- **Manual import:** users paste public job text, links, and contact details they are allowed to use. Greenhouse, Lever, Workable, LinkedIn, Naukri, and freelance URLs are not fetched automatically.

The structured registry lives in `source-registry.js`, including capability flags, limitations, safety notes, and review dates.

## Application workflow

1. Generate supported role clusters from reviewed profile data.
2. Check live feeds, guided portals, creative boards, freelance platforms, and company career pages.
3. Save or manually import a relevant opportunity.
4. Detect the official application route and public emails found only in pasted text.
5. Prepare an Application Packet with match evidence, missing information, reviewed drafts, and a Form Answer Kit.
6. Mark applications and replies manually and schedule follow-ups in Tracker.

Public emails are never guessed or enriched. Form answers use confirmed profile facts and placeholders when information is missing. No packet action sends email, submits a form, or applies automatically.

## Weekly discipline

Use **No Opportunity Left Behind** to mark the main channels opened, reviewed, saved, skipped, or completed. Coverage analytics are derived from local user actions and saved opportunities; empty activity remains empty rather than showing demo numbers.
