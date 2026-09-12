# Supabase setup

The frontend uses Supabase whenever `VITE_SUPABASE_URL` and either
`VITE_SUPABASE_PUBLISHABLE_KEY` or the legacy `VITE_SUPABASE_ANON_KEY` are set.
If they are absent, public content uses browser storage and admin access is disabled.

## Database deployment

Run these files in the Supabase SQL Editor in this order:

1. [`supabase-schema.sql`](supabase-schema.sql)
2. [`supabase-validation.sql`](supabase-validation.sql)
3. [`supabase-platform.sql`](supabase-platform.sql)
4. Create the administrator in Supabase Authentication.
5. [`supabase-admin.sql`](supabase-admin.sql)

`supabase-platform.sql` is transactional. If it fails, correct the reported
problem and rerun the entire file after the transaction rolls back.

The database provides shared CMS documents, detailed revision history, an administrator
allowlist, page-level image/video sections, categorized media storage, global and per-page SEO, and contact/reservation inquiries. RLS blocks direct
public writes. Public inquiries are accepted only through the Edge Function.

## Edge Function configuration

Deploy [`supabase/functions/submit-inquiry/index.ts`](supabase/functions/submit-inquiry/index.ts)
with these server-side variables:

- `ALLOWED_ORIGINS`, containing the exact permitted website origins
- Optional email settings documented in [`supabase/DEPLOYMENT.md`](supabase/DEPLOYMENT.md)

Never put the service-role key in a Vite variable or browser code.

## Frontend configuration

After the SQL and Edge Function deployment succeeds, configure the deployment:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The frontend adapters for CMS content, authentication, inquiries, and media are
already implemented. There is no browser-only administrator bypass.

## Administrator setup

Create `claudmarsjimenez.afhomes@gmail.com` in Supabase Authentication with a
strong password, then run [`supabase-admin.sql`](supabase-admin.sql). The login
alias `admin` resolves to that address. Only identities listed in
`public.admin_users` can open the dashboard or modify CMS content.

To revoke access, remove the corresponding row from `public.admin_users` and
revoke the user's active Auth sessions. Do not store admin passwords in source
code or Vite environment variables.

## Auth URL and recovery-email setup

In Authentication > URL Configuration, set the production Site URL and add
these exact redirect URLs (plus exact localhost equivalents when needed):

- `https://your-domain.example/admin/auth/callback`
- `https://your-domain.example/admin/reset-password`

Avoid broad production wildcards. The frontend uses PKCE and does not consume
Auth tokens on public routes.

The **Reset password** email template must be valid Go-template HTML. Keep the
standard `{{ .ConfirmationURL }}` link. If administrators should also be able
to type a code, include `{{ .Token }}` in the same template. The UI supports
both methods. Do not use `{{ .SiteURL }}` for the recovery destination when a
per-request `redirectTo` is expected.

Configure a custom SMTP provider for production, verify its sender domain, and
disable provider link tracking. Supabase's shared sender is intended for
testing and may restrict recipients or rate-limit security emails. After any
template or SMTP change, request one recovery email and inspect Authentication
logs for `user_recovery_requested`, template-rendering errors, SMTP errors, and
rate limits.

For security, keep user registration disabled unless the product explicitly
needs it, enable leaked-password protection and CAPTCHA/rate limits where the
project plan supports them, and keep the administrator allowlist in
`public.admin_users` as the authorization boundary.

## Verification

Verify against the configured Supabase project:

- A signed-out visitor is redirected to login.
- An authenticated non-admin cannot read admin-only records or write CMS data.
- A listed administrator can read inquiries, upload media, and save CMS data.
- A listed administrator can add, reorder, publish, and delete page media; public users can only view published files.
- Media that is still referenced by CMS content cannot be deleted from the admin UI.
- Saved social links, locations, SEO defaults, and per-page SEO appear on the public site after refresh.
- Restoring a CMS document or visual page version creates a new history/version entry.
- Removing allowlist membership prevents further admin operations.
- A public inquiry succeeds only from an allowed origin and is rate-limited.

For public-page local development, follow [`LOCAL_SETUP.md`](LOCAL_SETUP.md).
