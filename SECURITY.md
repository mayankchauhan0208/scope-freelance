# Security and privacy

Scope is an approval-first static web application.

- Résumé text, opportunities, and settings are stored in the current browser using `localStorage`.
- The application does not contain Gmail, LinkedIn, Google, or marketplace credentials.
- Email Desk opens an approved Gmail compose window. It cannot send in the background.
- Marketplace and LinkedIn searches open the provider's own website. Scope does not bypass authentication or scrape private pages.
- Clearing site data removes the locally stored profile and tracker data.

Do not commit API keys, OAuth client secrets, service-role keys, or private résumés to this repository.
