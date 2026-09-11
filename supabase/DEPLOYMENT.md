# Database deployment checklist

This database is prepared for a future hosted deployment while the application remains local-first today.

## Provision the database

In a new Supabase project, run these files in the SQL Editor:

1. `supabase-schema.sql`
2. `supabase-validation.sql`
3. `supabase-platform.sql`

Create the production administrator in Supabase Authentication, then run `supabase-admin.sql` to add that account to `public.admin_users`.

## Deploy public inquiries

Deploy `supabase/functions/submit-inquiry/index.ts` as the `submit-inquiry` Edge Function. Set these function secrets:

- `ALLOWED_ORIGINS`
- `EMAIL_TO` (temporary inbox, e.g. `claudmarsjimenez.afhomes@gmail.com`)
- `EMAIL_FROM` (for Gmail SMTP, use the authenticated Gmail address or a verified Gmail alias)
- either `RESEND_API_KEY` for the Resend email provider, or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` for Gmail/SMTP delivery

Hosted Edge Functions receive `SUPABASE_URL` and server credentials automatically; do not add them to frontend environment files. The function performs origin checks, payload validation, duplicate protection, and rate limiting before storing the inquiry and optionally sending the email notification to the configured inbox.

## Verify before launch

- Confirm the six `cms_documents` keys can be read anonymously.
- Confirm an unlisted authenticated user cannot update CMS documents or read inquiries.
- Confirm the listed administrator can save CMS documents and update inquiry status/notes.
- Submit the same inquiry twice and confirm the same request ID is returned without a duplicate row.
- Exceed five submissions from one origin address within an hour and confirm the function returns HTTP 429.
- Upload an allowed image and reject unsupported types or files larger than 5 MB at the storage policy boundary.

The current frontend is intentionally not connected to this database. A later integration should add Supabase-backed adapters for CMS, auth, inquiries, and media, while retaining the local adapters for development.
