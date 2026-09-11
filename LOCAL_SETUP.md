# Local mode

Run `npm.cmd run dev` and open the URL printed by Vite.

Public pages can run without Supabase by leaving both Supabase variables empty.
Admin access is intentionally unavailable in that mode: use the hosted Supabase
project to test authentication and CMS publishing. Admin login is `/admin/login`.

- Content edits are drafts until you click **Save changes**.
- Leaving a section with unsaved changes prompts before discarding them.
- CMS data is stored atomically in `afhomes.cms.store.v1` in localStorage. Older `afhomes.cms.*` data is read when no new store exists and is not deleted.
- Another tab changing a document causes a conflict error instead of silently overwriting it. Reload before editing again.
- **Backups & history** is available after signing in through Supabase.
- **Media** stores images locally in IndexedDB. Upload JPEG/PNG/WebP/GIF files up to 1 MB. Used images are embedded in content and content backups; unused library images are not included in those backups.
- Without Supabase, inquiries remain browser-local and are not sent to AFhomes.
- No Supabase network requests are made when the Supabase URL or key is empty. When both are configured, the app uses the hosted database, authentication, storage, and inquiry function instead.
- Browser storage is tied to the exact origin: localhost and 127.0.0.1, or different ports, have separate data.

Checks:

```text
npm.cmd run lint
npm.cmd run build
node scripts/check-cms.cjs
npx.cmd playwright test
```
