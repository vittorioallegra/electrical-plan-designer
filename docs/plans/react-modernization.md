# Plan: React and TypeScript modernization

Spec: docs/specs/react-modernization.md. Behavior must not change: every step ends with
typecheck, lint and the existing tests green (`pnpm verify` at the end of each phase).
Every step that changes commands, folders, key dependencies or conventions updates
`CLAUDE.md` in the same commit (step 14 only does the final pass).

## Target layout

```
package.json                   root: workspace scripts that proxy to apps/web and packages/domain
pnpm-workspace.yaml            existing file (keeps allowBuilds) + packages: [apps/*, packages/*]
vitest.config.ts               root Vitest `test.projects`: apps/web, packages/domain, scripts
eslint.config.js               single flat config for the whole repo (ESLint 10 looks up from
                               each file's directory, so one root config covers all packages)
.env.example, .env.memory, .env.e2e, .env.local   stay at the root (Vite `envDir` points here)
apps/web/                      Vite app (package @epd/web)
  index.html, vite.config.ts, vitest.db.config.ts, playwright.config.ts, tsconfig.json
  e2e/                         Playwright specs + helpers (was tests/e2e)
  src/
    app/
      main.tsx                 entry
      provider.tsx             global providers (was AppProviders.tsx) + QueryClientProvider
      router.tsx               createRoutes({ repos, queryClient }) factory (was App.tsx `routes`),
                               used by main.tsx and renderApp; lazy route modules, errorElement
      routes/                  thin route modules: login, signup, projects, catalog, profile,
                               project/{layout,plan,panel,quote,settings}, mobile/{projects,project},
                               not-found; each exports loader + Component + ErrorBoundary.
                               mobile/project composes editor canvas + bom Checklist (was
                               features/mobile/MobileProjectPage); quote composes quote + exports
      layouts/                 AppShell, MobileShell, ProjectFrame (+ BottomDrawer), RequireAuth
                               (session-expiry redirect; the auth check before loaders is a
                               middleware on the protected route)
      styles.css
    features/                  no imports between features; only the sub-folders needed
      auth/        components/ (AuthForm)
      projects/    api/ (useProjects, useCreateProject, useUpdateProject, useDeleteProject),
                   components/
      editor/      components/ (PlanView, ToolPalette, Inspector*, FloorsPanel, ProgressStrip,
                   SaveStatus, BoxContents, ProjectLoader body), canvas/ (PlanCanvas split,
                   hitTest, labels, snapping, viewport, useBackgroundImage), background/,
                   utils/commands.ts
      panel/       components/ (PanelView split), utils/commands.ts
      circuits/    components/ (CircuitsTab split), utils/commands.ts
      bom/         api/ (usePurchaseMarks, useSetPurchase), components/ (BomTab, Checklist,
                   PurchasesLoadError)  (purchases stay in bom: BomTab and Checklist both use them)
      checks/      components/ (WarningsTab), utils/focus.ts
      catalog/     components/ (CatalogPage, ItemDialog)
      quote/       components/ (QuotePage split), hooks/ (useQuote)
      exports/     utils/ (pdfKit, projectPdf, quotePdf, quoteCsv), hooks/
      mobile/      components/ (ViewModeGate)
      profile/     components/ (ProfilePage)
      settings/    components/ (SettingsPage)
    api/                       server state shared by several features (Bulletproof "shared api"):
                               query keys, useCatalogItems, useProfile, useUpdateProfile,
                               useProjectRecord, price-override mutations
    components/
      ui/                      Button, Dialog, Menu, NumberInput, Table, Tabs, TextField, Toast,
                               LanguageSwitch, ErrorState (new), RouteError (new)
      symbols/                 ElectricalSymbol, symbols.ts
      ConductorBadge.tsx       (was circuits/ConductorBadge; used by editor SegmentInspector)
    hooks/                     shared hooks: useAnalysis (BOM + checks of the open doc),
                               useCatalogLookup, useItemName, useItemsOf, useLocale
    lib/
      repositories/            types.ts, supabase.ts, memory.ts, memorySeed.ts, database.types.ts,
                               RepositoriesProvider (was src/data)
      auth/                    AuthProvider, useAuth, useSession (was features/auth/AuthProvider;
                               used by app layouts, editor background, profile)
      i18n/                    index.ts, locales/en.json, locales/it.json
      query-client.ts, format.ts, download.ts, cn.ts, colors.ts, describeBom.ts,
      describeChecks.ts (was checks/describe; used by checks and exports), viewMode.ts
    stores/
      editor/                  editorStore, EditorContext, autosave, unsavedStore (was src/state)
    config/env.ts              (was src/config.ts)
    testing/                   renderApp, pdfText, setup, editor test helpers (was state/testing.ts)
packages/domain/               @epd/domain: pure TS (was src/domain), deps zod + nanoid, own
                               tsconfig; source-only package, `exports: { "./*": "./src/*.ts" }`
                               (no build step, no barrel)
supabase/                      backend: config, migrations, seed (unchanged place)
scripts/                       env-local, check-env, build-seed (+ build-seed.test.ts)
tests/fixtures/                shared JSON fixtures (used by domain, web, seed and its test)
```

Import rules (ESLint `import-x/no-restricted-paths` zones with
`eslint-import-resolver-typescript`, so `@/` and relative paths resolve the same way; zones
per feature are generated in the config from the `features/` directory listing):
- `components`, `hooks`, `lib`, `api`, `stores`, `config`, `testing` must not import
  `features/*` or `app/*`.
- `features/X` must not import `features/Y` or `app/*`.
- `@epd/domain` imports nothing from `apps/*`; the existing purity rule moves to its package.
- No `index.ts` re-export barrels (lint rule on `export * from` / `export { … } from` in
  `index.ts` files).

Where the 46 current cross-feature imports go (counted from `src/features` on main):
- `bom/useAnalysis` (checks, circuits, editor ×3 incl. canvas, exports, mobile, panel, quote ×2)
  → `hooks/useAnalysis`.
- `bom/describe` (exports, mobile, quote) → `lib/describeBom`.
- `checks/describe` (exports/projectPdf) → `lib/describeChecks`.
- `catalog/useCatalog` (14 imports: provider in RequireAuth, profile/updateProfile, lookup,
  `useItemName`, `useItemsOf`) → `api/catalog` + `api/profile` (queries/mutations) and
  `hooks/useCatalogLookup`, `hooks/useItemName`, `hooks/useItemsOf`; the provider disappears
  (TanStack Query cache replaces it).
- `auth/AuthProvider` (editor background, profile, shell) → `lib/auth`.
- `bom/usePurchases`, `bom/PurchasesLoadError` (mobile Checklist) → Checklist moves into `bom`.
- `editor/canvas/PlanCanvas`, `editor/canvas/viewport` (mobile project page) → the mobile
  project page becomes the `app/routes/mobile/project` module, which may import features.
- `circuits/commands` used by the canvas picking → stays in circuits; the canvas receives the
  pick handlers from `app/layouts/ProjectFrame` (and the mobile route passes none).
- `circuits/ConductorBadge` (editor SegmentInspector) → `components/ConductorBadge`.
- `bom/BomTab`, `checks/WarningsTab`, `circuits/CircuitsTab`, `exports/useProjectPdfExport`
  (ProjectFrame) → ProjectFrame moves to `app/layouts`, which composes them.
- `exports/useQuoteExport` (QuotePage) → composed in the `app/routes/project/quote` module
  (QuotePage receives the export actions as props).
- `mobile/viewMode` (AppShell), `shell/LanguageSwitch` (ProjectFrame, MobileShell) →
  `lib/viewMode`, `components/ui/LanguageSwitch`; `shell/*` → `app/layouts`.
- `checks/focus` is only used inside `checks` (WarningsTab): stays in the feature.

## Data layer rules (step 10/11)

- One `QueryClient` per app instance: `main.tsx` creates it; `renderApp()` creates a fresh one
  per test with `retry: false`. App default `retry: false` for queries and mutations, so a failed
  load shows the error state at once with a Retry button, as today (no hidden backoff).
- Query keys include the signed-in user id; on sign-out or user change the provider calls
  `queryClient.clear()` so no data of a previous session is ever shown.
- Project record (editor and mobile): the loader uses `queryClient.fetchQuery` with
  `staleTime: 0` (always a fresh read on entering the project), because autosave advances the
  record version and a stale cached record would make the first save fail with
  `version_conflict`. The editor store is created once per mount from that record and is never
  re-seeded by a background refetch (`refetchOnWindowFocus: false` for the record; the store is
  the source of truth while the editor is open). Autosave writes the new `meta`/`version` into
  the cache (`setQueryData`) and invalidates the projects list.
- Loader outcomes keep today's screens and i18n keys: not found (`editor.notFound`), load failed
  (`editor.loadFailed`, now with Retry), invalid doc stays the recovery screen
  (`editor.recovery.*`, download raw JSON) rendered by the route component, not the error
  element. Store creation, autosave start/stop and `window.__epd` stay in the component effect
  (side effects never run in a loader).
- Auth before data: a middleware on the protected route awaits `repos.auth.getSession()` and
  redirects to `/login?next=…` before any child loader runs; `RequireAuth` keeps handling
  session expiry while a page is open.
- Shared catalog/profile: the protected route `prefetchQuery`s them without blocking navigation
  (today pages render while they load); pages that show "Loading" today use `ensureQueryData`.
- Mutations: purchase marks keep the per-key optimistic update and per-key rollback (concurrent
  toggles of different lines must not roll each other back) plus the existing error toast;
  issuing a quote invalidates the profile; catalog item edits invalidate catalog items; profile
  save updates the single profile query (ProfilePage and the quote page now read the same data).
- Forms (profile, project dialogs) copy query data into local draft state once; a refetch does
  not overwrite a draft being edited.
- Also ported: `ProfilePage` logo URL and `canvas/useBackgroundImage` signed URL (server data
  loaded in effects today) become queries; image decoding stays in the hook.

## Steps

Phase A — upgrades (current layout, one commit per library family, tests green each time)

1. Docs: spec and plan — `docs: add react modernization spec and plan`. Record the baseline
   first: `pnpm build` bundle sizes (the checked-out `dist/` is stale) and test counts.
2. React 19.3: react, react-dom 19.3.x (react-konva 19.3 requires `^19.3.0`, React Router 8
   requires ≥ 19.2.7), @types/react(-dom) 19, react-konva 19; fix `forwardRef` (`ui/Button.tsx`
   is the only one) → `ref` prop, `useRef` initial-argument and `RefObject` type errors, removed
   APIs. The `tests/setup.ts` react-konva mock stays a stub list; add any Konva component newly
   imported. Radix, zustand, lucide, Testing Library, TanStack Query peers already allow 19.
3. React Router 8: on 7.x first enable `future.v8_middleware` and fix warnings; then bump.
   `RouterProvider` now comes from `react-router/dom` (main.tsx, renderApp); `useMatches().data`
   → `loaderData` (not used today); loader `context` is always a `RouterContextProvider`.
   Node ≥ 22.22, Vite ≥ 7, ESM and ES2022 already met.
4. ESLint 10 + @eslint/js 10: replace `tseslint.config(...)` with `defineConfig` from
   `eslint/config`; fix new `eslint:recommended` rules (`no-useless-assignment`,
   `preserve-caught-error`: e.g. `importFile.ts` rethrows `ImportError` without `cause`,
   `no-unassigned-vars`) and JSX-as-reference `no-unused-vars` reports. Peer ranges checked:
   typescript-eslint 8.72, eslint-plugin-react-hooks 7.1.1, eslint-plugin-import-x 4.17,
   eslint-plugin-boundaries 7.3 allow ESLint 10; eslint-plugin-i18next 6.1.5 declares no peer,
   so confirm `no-literal-string` still reports (the existing i18n lint test or a fixture).
5. TypeScript 6.0, then the TypeScript 7 typecheck, then `exactOptionalPropertyTypes`, as three
   commits:
   a. `typescript@6.0`: fix deprecations (expected: drop `baseUrl`, make `paths` relative
      `./src/*`; whatever `tsc` 6 reports as deprecated, since 7 turns them into errors).
   b. TypeScript 7.0 ships its compiler as `tsc` (not `tsgo`) and has no programmatic API until
      7.1; typescript-eslint 8.72 peers `typescript <6.1.0`. So `typescript` stays 6.0 for
      typescript-eslint and editors, and TS 7 is added under an alias
      (`typescript7: npm:typescript@7`) with `typecheck` calling its `tsc` by explicit path.
      If the alias does not install or typecheck cleanly, stop at 6.0 and record it (see Open
      questions). `@vitejs/plugin-react` 6 / Vite 8 transform with Oxc and need no TS API.
   c. `exactOptionalPropertyTypes: true` and the resulting fixes (domain, repositories,
      generated `database.types.ts` excluded via its own handling if needed).

Phase B — workspace and backend boundary

6. pnpm workspace: add `packages:` to the existing `pnpm-workspace.yaml`; move the Vite app to
   `apps/web` (git mv; `vite.config.ts` gets `envDir` = repo root and `server.fs.allow` for
   `tests/fixtures`; `vitest.db.config.ts` `loadEnv` from the root; `playwright.config.ts`
   `testDir: 'e2e'`, webServer runs in `apps/web`; `db:types` output path; ESLint ignore of
   `database.types.ts`; `docs/deploy.md` paths; local `.claude/launch.json` (gitignored) points
   at the web package's Vite). Root `package.json` keeps `pnpm setup|dev|dev:mem|build|test|
   test:db|test:e2e|verify|db:*` with the same names (`pnpm --filter @epd/web …`), and a root
   `vitest.config.ts` with `test.projects` so `pnpm exec vitest run <path>` from the root still
   runs one file. `scripts/` and `supabase/` stay at the root; scripts keep writing/reading
   `.env.local` at the root. Verify `pnpm setup` from a clean clone (Docker) and `pnpm dev:mem`.
7. `packages/domain` as `@epd/domain` (git mv of `src/domain`, `package.json` with zod and
   nanoid, `exports: { "./*": "./src/*.ts" }`, own tsconfig and Vitest project, purity lint rule
   moved; fixture imports become `../../../tests/fixtures/…`). The web app imports
   `@epd/domain/<module>`. `scripts/build-seed.mjs` does not import the domain (it mirrors the
   defaults); `scripts/build-seed.test.ts` imports `@epd/domain/defaults` to keep them equal.

Phase C — folder structure

8. Move files to the target layout (pure `git mv` + import rewrites, no logic change): `app/`,
   `components/`, `lib/`, `stores/`, `config/`, feature sub-folders. i18n lint globs and the
   CLAUDE.md layout follow in the same commit.
9. Remove cross-feature imports as mapped above (shared hooks/lib, composition in `app`),
   then add the restricted-paths and no-barrel lint rules; lint must pass. Test: a Vitest file
   runs ESLint's API on fixture files (feature → feature, shared → feature, `index.ts` barrel)
   and expects each to be rejected.

Phase D — data layer and errors

10. TanStack Query v5 per "Data layer rules": `lib/query-client.ts`, provider, `api/` query
    keys; port catalog items, profile, projects list (+ create/update/delete mutations),
    purchase marks, project record, profile logo URL, background image URL. Remove
    `CatalogProvider` and the manual `useEffect` fetches. Tests: hooks with the in-memory
    repositories (loading, error + retry, per-key optimistic rollback, cache cleared on
    sign-out, editor re-entry reads a fresh record version and saves without conflict).
11. Route modules with loaders, the auth middleware, `ErrorBoundary` on every route, a root
    boundary, shared `ErrorState`/`RouteError` (link to projects + retry); lazy route modules
    so PDF/export code and the canvas are split from the initial bundle. `renderApp()` awaits
    the router's first navigation so existing component tests keep their queries unchanged.
    Tests: a failing loader and a throwing component show the error screen with retry and a
    link back; a signed-out visit to a protected route redirects to login without calling the
    project repository; not-found and invalid-doc screens unchanged.

Phase E — component size

12. Split `PlanCanvas` (layers: background/grid, walls, segments, nodes, overlays; hooks:
    viewport, pointer/drag, picking, keyboard) keeping `window.__epd` and the Playwright
    canvas tests unchanged; also used read-only by the mobile project route.
13. Split `CircuitsTab`, `PanelView`, `QuotePage` (list vs editor sub-components, hooks).

Phase F — wrap-up

14. CLAUDE.md final pass (workspace layout, commands incl. single-test commands from the root,
    import rules, data-layer convention), full `pnpm verify`, bundle size before/after recorded
    in Progress.

## Tests

- Existing suites are the safety net: 217 Vitest, 10 DB, 10 Playwright; only import paths and
  mechanical API changes allowed in them.
- New: query hooks (error + retry, per-key optimistic rollback, cache clear on sign-out, fresh
  record on editor re-entry), route error elements, auth middleware redirect, lint rule test
  (fixture imports that must be rejected, run via ESLint's API in a Vitest file).

## Risks

- TypeScript 7 tooling: TS 7.0 has no programmatic API (expected in 7.1) and typescript-eslint
  8.72 peers `typescript <6.1.0`. Mitigation in step 5b (TS 6 as `typescript`, TS 7 aliased for
  typecheck); fallback is TS 6.0 now and TS 7 once typescript-eslint supports it.
- Stale project record in the query cache → `version_conflict` on the first autosave after
  re-entering a project, or a background refetch resetting the editor and its undo history.
  Mitigated by the "Data layer rules" (fresh fetch, no re-seed) and a dedicated test.
- Loaders run before components: without the auth middleware a signed-out visit would hit the
  repositories and show an error instead of the login redirect.
- Query cache across sessions: without `clear()` on sign-out a second user could briefly see
  the first user's projects/catalog.
- react-konva 19 / Konva behavior changes on the canvas → covered by Playwright canvas specs.
- Large `git mv` steps make blame noisy; keep moves in commits without logic changes so
  `git log --follow` and review stay readable.
- Workspace move breaks scripts and paths (seed generation, `check-env`, `.env*` lookup,
  launch config, Playwright webServer cwd) → `pnpm setup` from a clean clone is part of step 6
  verification.
- Lazy routes make first renders async; component tests that query synchronously after
  `renderApp()` would fail unless `renderApp()` waits for the first navigation.

## Progress

Phase: implementation
Branch: feat/react-modernization
Base: main
Spec: docs/specs/react-modernization.md
Approved: yes (2026-10-25)

### Steps
- [x] 1. Docs: spec and plan — `docs: add react modernization spec and plan`
- [x] 2. React 19 + react-konva 19 — `feat: upgrade to React 19.3 and react-konva 19`
- [x] 3. React Router 8 — `feat: upgrade to React Router 8`
- [x] 4. ESLint 10 — `chore: upgrade to ESLint 10`
- [x] 5. TypeScript 6 → 7, exactOptionalPropertyTypes
  - [x] 5a. TypeScript 6.0 — `chore: upgrade to TypeScript 6.0`
  - [x] 5b. TypeScript 7 typecheck — `chore: typecheck with TypeScript 7`
  - [x] 5c. exactOptionalPropertyTypes — `chore: enable exactOptionalPropertyTypes`
- [x] 6. pnpm workspace, app in apps/web — `refactor: move the app into a pnpm workspace at apps/web`
- [x] 7. packages/domain (@epd/domain) — `refactor: extract the domain into the @epd/domain package`
- [x] 8. Move files to the target layout — `refactor: move files to the Bulletproof React layout`
- [x] 9. Remove cross-feature imports, import-boundary lint rules — `refactor: enforce feature import boundaries`
- [x] 10. TanStack Query for server state — `feat: move server state to TanStack Query`
- [x] 11. Route loaders, error elements, lazy routes — `feat: load routes with loaders, error boundaries and lazy modules`
- [ ] 12. Split PlanCanvas
- [ ] 13. Split CircuitsTab, PanelView, QuotePage
- [ ] 14. CLAUDE.md, full verify, bundle sizes

### Verification
- qa: pending
- review: pending

### Decisions
- Folder convention: Bulletproof React (not Feature-Sliced Design), see spec.
- Upgrades before moves, so each upgrade is a small diff on a known layout.
- React target is 19.3.x (react-konva 19.3 peer `^19.3.0`).
- TypeScript: `typescript` stays 6.0 for typescript-eslint; TS 7 runs the typecheck through an
  npm alias; fall back to 6.0 only if the alias does not work.
- Purchases stay in the `bom` feature (BomTab and the mobile Checklist share them); no separate
  `purchases` feature.
- Auth context moves to `lib/auth`; auth check before loaders is a router middleware.
- Mobile project page becomes an `app` route module composing the editor canvas and the bom
  Checklist (it needs two features).
- Routes become a `createRoutes({ repos, queryClient })` factory so loaders get dependencies
  without React context; tests build it with in-memory repositories.
- Query defaults: `retry: false`, user id in keys, `clear()` on sign-out; project record always
  fetched fresh on entering a project and never re-seeds an open editor.
- `.env*` files stay at the repo root (`envDir`), so `env-local`/`check-env` do not change.
- One root ESLint config and one root Vitest config (`test.projects`) for the workspace.
- Import boundaries: `import-x/no-restricted-paths` + `eslint-import-resolver-typescript`.
- ESLint 10: the new recommended rules (`preserve-caught-error`, `no-useless-assignment`,
  `no-unassigned-vars`) are active and report nothing on the current code; `i18next/no-literal-string`
  still reports (checked with a probe file).
- TypeScript 7 alias works: `typecheck` runs `node node_modules/typescript7/bin/tsc` (7.0.2,
  ~0.8 s); `node_modules/.bin/tsc` stays TypeScript 6.0.3 for typescript-eslint and editors.
- Workspace: `tests/setup.ts` moved to `apps/web/tests/setup.ts` for now (step 8 moves it to
  `src/testing`); e2e fixture files are resolved with `fixture(name)` in `e2e/helpers.ts`;
  `tsconfig.base.json` holds shared compiler options, root `tsconfig.json` covers `scripts/`.
  Checked: `pnpm setup` from a clean copy of the tracked files, `dev:mem` in the browser.
- `@epd/domain`: `nanoid` moved to the domain package (web keeps `zod` for `config.ts`); domain
  tests run in the `node` environment; the purity lint rule now bans `@/*`, `@epd/web` and
  `apps/**` imports (checked with a probe file).
- Step 8 also did the pure moves from the cross-feature mapping (useAnalysis → `hooks/`,
  describe → `lib/describeBom|describeChecks`, viewMode → `lib/`, ConductorBadge → `components/`,
  LanguageSwitch → `components/ui/`, AuthProvider → `lib/auth/`, shell/RequireAuth/MobileShell/
  ProjectFrame → `app/layouts/`, SettingsPage → `features/settings`); `data/index.tsx` became
  `lib/repositories/provider.tsx`, `state/testing.ts` became `testing/editor.ts`. Built CSS is
  byte-identical to the previous commit (Tailwind source detection unaffected).
- Step 9: CatalogProvider + `useCatalog` moved as-is to `src/api/catalog.tsx` (step 10 replaces
  them with queries); `useItemName`/`useItemsOf` to `src/hooks/`. `QuoteDocument` (pure data type)
  moved to `@epd/domain/quote` so `quote` and `exports` share it. Composition in `src/app/routes`:
  `project/layout` (ProjectLoader gets a `renderFrame` prop for ProjectFrame), `project/plan`
  (circuit pick handlers injected into PlanCanvas via PlanView), `project/quote` (QuotePage gets
  the exporter as a prop), `mobile/project` (was MobileProjectPage; Checklist moved into `bom`).
  `src/testing` may import `src/app` (renderApp). `unrs-resolver` (TS import resolver) is denied
  its build script in `allowBuilds`; it uses its prebuilt optional binding.
- Step 10: `useCatalog()` stays as a derived hook over the catalog and profile queries (same
  shape for its consumers, no provider); `RequireAuth` keeps both queries observed for the whole
  signed-in session (loaded once on entry, as the provider did). ProfilePage edits a draft of the
  text fields only and saves just those (it no longer resends a stale copy of price overrides and
  box presets). Logo shown through a React 19 ref-cleanup `<img>` (object URL revoked).
  Purchase ticks update the cache synchronously before the mutation (per-line rollback).
  `notifyManager.setScheduler(queueMicrotask)`: the default `setTimeout(0)` notification made a
  controlled checkbox show its old value right after the click (caught by the mobile E2E).
  Exports still download logo/backgrounds on demand at export time (action, not page data).
- Step 11: loaders live in `app/router.tsx` (lazy is per `Component`, so data loads in parallel
  with the chunk); the project route revalidates only on a new id or Retry, and `ProjectLoader`
  is keyed by id and keeps the record it mounted with. The query cache is cleared only when a
  known user signs out or changes (clearing on the first session cancelled the loader's fetch).
  New i18n key `errors.unexpected`. Bundle after step 11 (`vite build`): initial JS `index`
  449 kB + shared chunks (react-dom, supabase, query, i18n) = ~275 kB gzip loaded on `/login`
  and `/projects` (baseline main chunk 1,646 kB / 506 kB gzip); `PlanCanvas` 354 kB, `pdfKit`
  402 kB, `pdf` 430 kB are lazy.
- CLAUDE.md is updated in each step that changes commands or folders, not only at the end.
- User, 2026-10-25: plan approved; do the pnpm workspace split now (Phase B stays); TypeScript
  6.0 is acceptable for criterion 1 if the TS 7 alias does not work; no Edge Function for
  server-side BOM/quote in this change.
- Baseline before step 2 (`vite build`, main @ 1fee0a1): main chunk `index` 1,646.53 kB
  (gzip 505.89 kB), `pdf` 430.17 kB (gzip 129.28 kB), `html2canvas` 199.39 kB, `index.es`
  151.37 kB, pdf.js worker 1,264.34 kB, CSS 23.20 kB; `dist/assets` 3.6 MB. Tests: Vitest
  40 files / 217, test:db 10, Playwright 10.

### Open questions
- None open. Answered by the user on 2026-10-25, see Decisions.

### Next
Step 12: split `PlanCanvas` (layers: background/grid, walls, segments, nodes, overlays; hooks:
viewport, pointer/drag, picking, keyboard), keeping `window.__epd`, `pickHandlers` and the
Playwright canvas specs unchanged; then step 13 (CircuitsTab, PanelView, QuotePage).

## Review record

Autoplan run on 2026-10-25 (condensed: CEO, eng and DX passes done inline by Claude; design
phase skipped, no UI change; Codex outside voice unavailable, CLI not installed). Facts checked
against main (`src/` imports, `ProjectLoader`, `autosave`, `CatalogProvider`, `usePurchases`,
`RequireAuth`, `main.tsx`, `renderApp`, `tests/setup.ts`, configs, scripts) and npm registry
peer ranges / official upgrade guides (React Router v7→v8 guide and changelog, ESLint 10
migration guide, TypeScript 7.0 release notes).

<!-- autoplan-accepted:eng -->
- Cross-feature import mapping covers all 46 imports found on main (auth, purchases, mobile
  canvas, ConductorBadge, checks/describe were missing; checks/focus claim was wrong).
- Data layer rules: fresh project record on entry, no editor re-seed, auth middleware before
  loaders, cache clear on sign-out, `retry: false`, per-key optimistic rollback; each with a test.
- Routes factory with injected repositories and QueryClient; renderApp awaits first navigation.
- TypeScript 7 via alias with TS 6 for typescript-eslint; `tsc` binary, not `tsgo`.
- RouterProvider from `react-router/dom`; `v8_middleware` enabled on 7.x before the bump.
- ESLint 10 config via `defineConfig`, new recommended rules fixed.
- Workspace details: existing pnpm-workspace.yaml, root `.env*` with `envDir`, root Vitest
  projects, Playwright `testDir`, db:types path, deploy doc, launch config.
<!-- /autoplan-accepted:eng -->
<!-- autoplan-accepted:dx -->
- Root commands keep their names; single-file test command from the root still works; CLAUDE.md
  updated in the step that changes commands.
<!-- /autoplan-accepted:dx -->
<!-- autoplan-accepted:ceo -->
- Baseline bundle sizes and test counts recorded in step 1; Phase B value raised as an open
  question rather than cut.
<!-- /autoplan-accepted:ceo -->
