# AFhomes Digital Experience

Vite + React 19 SPA for the AFhomes hospitality/wellness brand. React Router 7, Tailwind CSS v4, `motion` (Framer Motion v12+) for animation.

## Commands

- `npm run dev` — Vite dev server
- `npm run lint` — typecheck only (`tsc --noEmit`). There is **no ESLint**
- `npm run build` — `tsc -b && vite build` (builds into `dist/`)
- `npm run preview` — serves the built `dist/`
- No test suite exists.

Verify changes with `npm run lint` then `npm run build`. `tsc --noEmit`/`tsc -b` runs with `strict`, `noUnusedLocals`, `noUnusedParameters`: unused imports/params/props break the build, so remove them when their last usage is dropped.

## Architecture

- Entry `src/main.tsx` → `src/app/App.tsx` (`MotionConfig`) → `src/app/routes.tsx` (lazy routes under a shared `Layout`).
- Path alias `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.app.json` paths). `baseUrl` was removed to avoid the TS 7 deprecation — don't re-add it; `paths` resolves relative to the tsconfig.
- Pages under `src/pages/`; reusable UI in `src/components/ui/`; home sections in `src/components/home/`.
- Routing: client-side paths for experiences use slugs (e.g. `/experiences/{slug}`); some route paths are hardcoded in `routes.tsx` (e.g. `hotspring-ecofarm-resort` — live in `Navbar`/`Layout` links).

## Data layer

- Pages → `src/services/*Service.ts` → `src/api/*.ts` → either live `apiClient` fetch or local mocks.
- Mock/API switch is driven by `VITE_API_BASE_URL` (`.env.example`). Unset → `src/data/mock/*` is used; the API throws if called without it.
- Fetching convention: `useAsync(factory, deps)` hook (`src/hooks/useAsync.ts`) returns `{ data, loading, error, retry }`; leaf UI uses `LoadingState` / `ErrorState` from `src/components/ui/Feedback`. Follow this pattern for new async data — don't hand-roll loading states.

## Styling (Tailwind v4)

- Global theme lives in `src/styles/index.css` `@theme` block — this is the only CSS file. Tokens are semantic: green-led brand (`leaf`/`pine`/`sage`, dominant #57AB4B), `navy`, `cream`, `ink`, plus restrained accents (gold, cyan, coral, pink).
- Use existing tokens; don't invent ad-hoc hex colors. Green is the supporting brand/wellness color — use it heavily; other accents sparingly.
- `@theme` / `@apply` show as "Unknown at rule" in VS Code's built-in CSS lint. This is expected: `.vscode/settings.json` sets `css.lint.unknownAtRules: ignore` and the Tailwind IntelliSense extension is installed. Don't "fix" these as errors.

## Image conventions

- ALL imagery is centralized in `src/lib/images.ts` (Unsplash CDN placeholders) and consumed via `getPlaceholder(key)` → `ImageSpec`. Swap image URLs there only; never hardcode `<img src>` URLs in components.
- `SmartImage` (lazy-load + graceful fallback) and `ImageReveal` (cinematic clip-path reveal) are the primitives for loading images.
- Real brand logo lives at `src/assets/logo.png` (imported, not a URL).

### Layering rules (do not regress)

- Stacking: `relative` parent, image at bottom, semi-transparent gradient overlay, content above (`relative z-10`). Never place an opaque block (`bg-cream-200`, solid white/green/navy) over an image.
- Overlays must be transparent/gradient (`/20`, `from-transparent to-black/40`, etc.); images are the visual hero.
- `ImageReveal`'s cover panel must end clipped away (`clip-path: inset(0 0 100% 0)`) so the image is exposed; if JS fails, image must still be visible.
- No huge z-index hacks — simple local stacking only.
- Body has `overflow-x: clip` — horizontal overflow won't show a scrollbar; verify with `scrollWidth - clientWidth`, not scrollbars.

## Gotchas

- Sticky positioning creates a stacking context; content that scrolls past a sticky image needs `relative z-10` (see `SmartWellnessSection` feature list).
- Mega dropdown in `Navbar` is anchored to the button/first nav item (`left-0`) and must stay within the viewport at all desktop widths.
- `Navbar`: the "Explore AFhomes" CTA is desktop-only (`isDesktop` check) — keep it hidden on mobile; the real logo replaces any text wordmark.
- `public/` holds only static files (favicon, robots.txt, sitemap.xml).