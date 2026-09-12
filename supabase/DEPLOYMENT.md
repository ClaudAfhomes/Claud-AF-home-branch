# Supabase production deployment

The frontend already uses Supabase for shared CMS content, administrator
authentication and password recovery, inquiry management, and media uploads.
Before deploying the frontend, configure the following hosting environment
variables. Use a publishable key only; never expose a secret or service-role
key in browser code.

```env
VITE_SUPABASE_URL=https://tubmcobqlwvtdilvstbt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

Set both variables in Vercel for **Production**, **Preview**, and
**Development**. Redeploy after changing a `VITE_` variable because Vite embeds
these public values during the build. Leave `VITE_API_BASE_URL` unset unless a
separate AFhomes API has actually been deployed; Supabase-powered CMS, auth,
media, and inquiries do not require it.

## Provision the database

In a new Supabase project, run these files in the SQL Editor:

1. `supabase-schema.sql`
2. `supabase-validation.sql`
3. `supabase-platform.sql`

Then apply the versioned migrations in `supabase/migrations/`. The visual page
builder migration creates draft and published page tables, ordered reusable
sections, media metadata, navigation, site settings, and their RLS policies.

```sh
npx supabase link --project-ref tubmcobqlwvtdilvstbt
npx supabase db push --linked
```

Create the production administrator in Supabase Authentication, then run `supabase-admin.sql` to add that account to `public.admin_users`.

## Deploy public inquiries

Link the CLI to the hosted project and deploy the function. The checked-in
`supabase/config.toml` makes this public form endpoint reachable without a user
JWT; origin validation, rate limiting, and payload validation are enforced by
the function itself.

```sh
npx supabase login
npx supabase link --project-ref tubmcobqlwvtdilvstbt
npx supabase functions deploy submit-inquiry
```

Set these function secrets in Supabase (not Vercel):

- `ALLOWED_ORIGINS` containing comma-separated exact origins, without trailing
  slashes (for example `https://afhomes.com.ph,https://www.afhomes.com.ph`)
- `EMAIL_TO` (temporary inbox, e.g. `claudmarsjimenez.afhomes@gmail.com`)
- `EMAIL_FROM` (for Gmail SMTP, use the authenticated Gmail address or a verified Gmail alias)
- either `RESEND_API_KEY` for the Resend email provider, or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` for Gmail/SMTP delivery

Hosted Edge Functions receive `SUPABASE_URL` and server credentials automatically; do not add them to frontend environment files. The function performs origin checks, payload validation, duplicate protection, and rate limiting before storing the inquiry and optionally sending the email notification to the configured inbox.

```sh
npx supabase secrets set ALLOWED_ORIGINS=https://afhomes.com.ph,https://www.afhomes.com.ph EMAIL_TO=claudmarsjimenez.afhomes@gmail.com
npx supabase secrets list
```

Add a specific Vercel preview URL to `ALLOWED_ORIGINS` when testing a preview.
Do not use a wildcard: preview deployments are public input surfaces too.

Configure Supabase Authentication URL settings with the production Site URL and
the exact `/admin/auth/callback` and `/admin/reset-password` redirect URLs.
For detailed authentication, email, and local-development guidance, see
[`SUPABASE_SETUP.md`](../SUPABASE_SETUP.md).

## Configure Vercel

1. Import the repository into Vercel and keep the project root at the repository root.
2. Vercel will use Node 22, run `npm run build`, and publish `dist/` from the
   checked-in `vercel.json`.
3. Add the two `VITE_SUPABASE_*` variables shown above. They are public browser
   configuration, not secrets; never add `SUPABASE_SECRET_KEYS` or
   `SUPABASE_SERVICE_ROLE_KEY` to Vercel.

The visual CMS requires no additional Vercel variables. Apply migrations
`20260912011423_cms_admin_experience_seo_history.sql` and
`20260912012157_cms_settings_validation.sql`, followed by
`20260912075153_detailed_cms_audit_history.sql`, before deploying the matching
frontend. The final migration adds backward-compatible structured audit
details, total change counts, content revision numbers, the archived action,
and server-side audit-value sanitization. It also replaces
`save_cms_documents` so each content write and its history row remain in the
same database transaction. Existing restore snapshots and older history rows
remain usable.

## Visual page builder

The builder is available under **Admin → Pages**. New published pages use their
slug at the website root (for example, `services` publishes at `/services`). To
replace an original page with a builder-managed layout, use its reserved slug:
`home`, `vip`, `about`, `experiences`, `stories`, `faq`, `compliance`, or
`contact`. Unpublishing it immediately restores the original page.

Publishing creates a public snapshot and retains the prior published snapshot
in `cms_page_versions`. Draft tables are admin-only; anonymous visitors can
read only the separate published snapshot tables.
4. Deploy once, attach the production domain, then update `ALLOWED_ORIGINS` and
   Supabase Auth URL Configuration to that exact HTTPS domain.
5. Redeploy and test a direct visit (not client navigation) to `/contact`,
   `/stories`, `/afhomes-admin`, and `/admin/reset-password`. The SPA rewrite in
   `vercel.json` keeps these routes working on refresh.

The generated `/assets/*` files receive immutable one-year caching because
Vite fingerprints their filenames. HTML and public metadata retain Vercel's
normal revalidation behavior. Baseline response headers disable MIME sniffing
and unused camera, microphone, and geolocation capabilities.

## Verify before launch

Run the local production gate first:

```sh
npm ci
npx playwright install chromium
npm run deploy:check
```

After Vercel reports the deployment as ready, run the public online smoke test
against its production or preview URL:

```sh
npm run test:online -- https://your-deployment.vercel.app
```

This checks direct SPA routes, `robots.txt`, `sitemap.xml`, browser-to-Supabase
requests, runtime errors, and that the deployed administrator bundle contains
the detailed Change History / Restore interface. Signing in remains a manual
test because administrator credentials must not be stored in the repository.

- Confirm the seven `cms_documents` keys can be read anonymously.
- Confirm an unlisted authenticated user cannot update CMS documents or read inquiries.
- Confirm the listed administrator can save CMS documents and update inquiry status/notes.
- Submit the same inquiry twice and confirm the same request ID is returned without a duplicate row.
- Exceed five submissions from one origin address within an hour and confirm the function returns HTTP 429.
- Upload an allowed image and reject unsupported types or files larger than 5 MB at the storage policy boundary.
- Confirm `/robots.txt` and `/sitemap.xml` return their actual files rather than
  the SPA HTML.
- Confirm browser developer tools show no mixed-content, CORS, or failed
  Supabase requests on the production domain.
