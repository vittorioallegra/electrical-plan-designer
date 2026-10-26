# Electrical Plan Designer

Web app for electricians: draw a residential electrical system on a floor plan, design
the panel, route circuits through conduits, and get a computed BOM, checks, PDF/CSV
exports, a quote and a phone checklist. Spec and plan: docs/specs/electrical-plan-designer.md,
docs/plans/electrical-plan-designer.md.

## Commands

Node 24 via nvm (`export PATH=~/.nvm/versions/node/v24.22.1/bin:$PATH` if `node` is
missing), pnpm 12.

- `pnpm setup` — install, start local Supabase, write `.env.local`, reset DB, install Chromium
- `pnpm dev` — dev server on :5173 against local Supabase (runs `scripts/check-env.mjs` first)
- `pnpm dev:mem` — dev server with in-memory repositories, no Docker needed
- `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm format`. `typecheck` runs TypeScript 7
  (`typescript7` npm alias); `typescript` stays 6.0 because typescript-eslint needs its API
- `pnpm test` — Vitest (projects: web/jsdom, domain/node, repo). Quiet, failures only:
  `pnpm exec vitest run --reporter=dot --silent`. One file, from the root:
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot` (one test: `-t "riser"`)
- `pnpm test:db` — integration tests against local Supabase (`apps/web/src/**/*.db.test.ts`)
- `pnpm test:e2e` — Playwright (`apps/web/e2e`, own Vite server on :5174 in `e2e` mode);
  quiet: `pnpm exec playwright test --reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:db, test:e2e (the gate; no CI yet)
- `pnpm db:start | db:stop | db:reset | db:types`, `pnpm env:local`
- `pnpm db:seed` — regenerate `supabase/seed.sql` from `tests/fixtures/demo-project.json`
  (a unit test fails when they drift), then `pnpm db:reset`
- `pnpm demo:epd` — regenerate `tests/fixtures/demo-project.epd` (drawing from
  `demo-project.json`, business data in `scripts/build-demo-epd.mjs`; a unit test checks drift)

Local seed login (local stack only): `dev@example.test` / `devpassword` ("Demo house").
Schema changes: new file in `supabase/migrations/`, then `pnpm db:reset && pnpm db:types`.
Cloud deploy: docs/deploy.md. Docker is needed by `dev`, `test:db`, `test:e2e`, `db:*`,
`env:local`, `setup`; E2E share the demo project, so `pnpm db:reset` after a failed run.

## Layout

pnpm workspace (Bulletproof React folders). Root: scripts proxying to `pnpm --filter @epd/web`,
one ESLint config, `vitest.config.ts` (projects), `tsconfig.base.json`, `.env*` (Vite `envDir`).
Below, `src/` = `apps/web/src/` (package `@epd/web`: Vite/Vitest/Playwright configs, `e2e/`).

- `packages/domain/` — `@epd/domain`: pure TS (model, geometry, lengths, routing, BOM, checks,
  quote, catalogs, `.epd` project file schema); source-only, imported as `@epd/domain/<module>`, no barrel
- `src/app/` — `main.tsx`, `provider.tsx`, `router.tsx` (`createRoutes({ repos, queryClient })`),
  `auth.ts` (auth middleware), `layouts/`, `routes/` (route modules composing features)
- `src/features/<name>/` — auth, projects, editor, panel, circuits, catalog, bom, checks, quote,
  exports, mobile, profile, settings; sub-folders `components/ hooks/ utils/ api/` as needed
- `src/api/` — shared TanStack Query hooks + `queryOptions` (`keys.ts`, catalog, profile, record)
- `src/components/` (`ui/`, `symbols/`), `src/hooks/` (shared hooks), `src/config/env.ts`
- `src/lib/` — `repositories/` (interfaces, Supabase + in-memory; the only Supabase code),
  `auth/`, `i18n/` (`locales/en.json` base, `it.json`), `projectFile/` (`.epd` zip read/write,
  `fflate`), `query-client.ts`, formatting helpers
- `src/stores/editor/` — editor store (open `ProjectFile` + assets, zustand + immer patches),
  undo/redo, autosave to the draft (`lib/repositories/drafts.ts`, IndexedDB)
- `src/testing/` — `setup.ts`, `renderApp.tsx`, `editor.ts`, `pdfText.ts`
- `supabase/` (config, migrations, seed), `scripts/` (check-env, env-local, build-seed),
  `tests/fixtures/` (shared fixtures; e2e uses `fixture(name)`), `tests/lint/` (lint rule tests)

## Conventions

- Repo in English; UI strings only via `t('...')` (`i18next/no-literal-string` on `.tsx` in
  `app`, `components`, `features`, `lib`); every key in both `en.json` and `it.json` (tested).
- Imports (ESLint): features never import other features; the shared folders (`api`,
  `components`, `config`, `hooks`, `lib`, `stores`) never import `features` or `app`; `testing`
  may import `app`; no `index.ts` barrels; `@epd/domain` imports nothing from the app. Shared
  code moves to a shared folder, or `src/app` composes features (props, render props, injected
  handlers). Alias `@/` = `src/`.
- Server data: TanStack Query over `useRepositories()`, never `useEffect` fetches. Keys from
  `src/api/keys.ts` start with the user id; cache cleared when a user signs out or changes; no
  retries or refetch on focus. The project record is fetched fresh and never re-seeds an open
  editor; autosave writes only the draft, and a draft opened from the same record is resumed.
- Routes: auth middleware before loaders; loaders read via the query client, side effects stay
  in components; every route has an `ErrorBoundary` (`components/ui/RouteError`); editor,
  canvas and PDF code are lazy. `renderApp()` (real routes, in-memory repos, fresh query client)
  waits for the first navigation; `prepare` installs spies before loaders run.
- Tests next to the code, each with a card comment `// protects=...; fails_when=...; no_claim=...`.
- Project file schema: no migrations before the first release (versions stay 1; update
  `projectFile/fixtures/v1.json` and run `pnpm demo:epd`). After it, each change bumps the
  version, adds a migration (`projectFile/migrations.ts`) and freezes a previous-version fixture.
- Lengths: integer mm in the domain, meters at the edges. Money: integer cents.
- PDFs (jsPDF Helvetica) use WinAnsi characters only; PDF tests run in `@vitest-environment node`.
- Mobile view (< 768 px) is chosen once per tab session (`sessionStorage` `epd.viewMode`).
- jsdom has no canvas (`src/testing/setup.ts` stubs `react-konva`): canvas behavior is tested
  in Playwright via `window.__epd` (env `.env.e2e`; `.env.memory` for `dev:mem`).
- `useEditor(selector)` returns raw store fields; derive arrays with `useMemo` (render loop).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
