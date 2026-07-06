# Email reliability

## Current production diagnosis

The Supabase project has email/password authentication enabled and email confirmation required, but custom SMTP is not configured. Supabase's shared development mailer has strict rate limits and is not suitable for dependable public signup or password-reset delivery. This is why verification/reset messages can be delayed or not received.

RoleDesk application and recruiter messages remain editable drafts. Opening Gmail creates a reviewed compose window; RoleDesk does not send and therefore must not describe a compose-open or user-marked status as provider-confirmed delivery.

## Required production SMTP configuration

Configure these values in **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**. Never add them to the GitHub Pages repository:

- SMTP host and port
- SMTP username and password/API credential
- Sender/admin email on a verified domain
- Sender name (`RoleDesk`)

Configure the sending domain with the provider's SPF and DKIM records and add a DMARC policy. Keep the current production Site URL and redirect allowlist. After SMTP is active, set a reasonable auth-email rate limit and test verification, resend, and password reset with at least two unrelated mailbox providers.

## Delivery evidence

- `activity_logs` contains user actions such as draft saved, compose opened, or marked sent. These are user-reported and never proof of delivery.
- `email_delivery_logs` is reserved for a trusted backend/provider webhook. Authenticated users can read their own rows but cannot create, edit, or delete them.
- Provider responses and failures must be written only by a trusted server or Edge Function after webhook signature verification.

## Operational checks

1. Create a new test account and confirm the verification email arrives.
2. Use **Resend verification**, confirm the UI message, and check spam.
3. Request password reset and complete the reset on the production URL.
4. Review Supabase Auth logs and SMTP provider delivery/bounce logs.
5. Confirm sender alignment, SPF, DKIM, and DMARC.
6. Never put SMTP credentials, `service_role`, or provider webhook secrets in frontend JavaScript.
