# Deploying

The app is a static site: no backend, no environment variables. `pnpm build` writes
`apps/web/dist/` (typecheck first, then Vite). Any static host works; it needs two things:

- **SPA fallback**: every path (`/project/plan`, …) serves `index.html`.
- **No long cache for the service worker**: `sw.js`, `registerSW.js`, `manifest.webmanifest`
  and `index.html` must be revalidated on every load, or users keep an old version. Files in
  `assets/` have content hashes and can be cached forever.

`apps/web/public/_redirects` and `apps/web/public/_headers` (copied into `dist/`) set both on
Netlify and Cloudflare Pages.

## Netlify

New site from the Git repository:

- Build command: `pnpm build`
- Publish directory: `apps/web/dist`
- Environment: `NODE_VERSION=24` (pnpm comes from `packageManager` in `package.json`)

## Cloudflare Pages

Create a Pages project from the repository with the same build command and output directory
(`apps/web/dist`) and `NODE_VERSION=24`. `_redirects` and `_headers` are read as on Netlify.

## GitHub Pages

GitHub Pages has neither rewrites nor headers. Serve the app from a custom domain at the root
(the app assumes `/` as base path), and copy `index.html` to `404.html` after the build so deep
links load the app. The service worker is cached by GitHub's CDN for up to 10 minutes, so an
update reaches users a little later.

## Updates and offline use

The service worker (vite-plugin-pwa, `registerType: 'autoUpdate'`) precaches every built file,
pdf.js worker and wasm decoders included: after the first visit the app opens and imports PDF
plans offline (checked by `apps/web/e2e/offline.spec.ts`). A new deploy is picked up on the
next load. Projects are files on the user's computer and drafts live in the browser, so a
deploy never touches user data; a new app version must still open old `.epd` files (see the
versioning rule in `CLAUDE.md`).
