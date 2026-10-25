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
- `pnpm test` — unit + component tests (Vitest, jsdom). Quiet, failures only:
  `pnpm exec vitest run --reporter=dot --silent`
- Single test file (from the repo root):
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot`;
  single test by name: add `-t "riser"`
- `pnpm test:db` — integration tests against local Supabase (`apps/web/src/**/*.db.test.ts`)
- `pnpm test:e2e` — Playwright (`apps/web/e2e`, own Vite server on :5174 in `e2e` mode);
  quiet: `pnpm exec playwright test --reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:db, test:e2e (the gate; no CI yet)
- `pnpm db:start | db:stop | db:reset | db:types`, `pnpm env:local`
- `pnpm db:seed` — regenerate `supabase/seed.sql` from `tests/fixtures/demo-project.json`
  (a unit test fails when they drift), then `pnpm db:reset`

Local seed login (local stack only): `dev@example.test` / `devpassword`, with the
"Demo house" project. Schema changes: add a new file in `supabase/migrations/`, then
`pnpm db:reset && pnpm db:types`. Cloud deploy: docs/deploy.md.

Need Docker (local Supabase stack): `dev`, `test:db`, `test:e2e`, `db:*`, `env:local`,
`setup`. Everything else runs without it.

## Layout

pnpm workspace: root scripts proxy to the app with `pnpm --filter @epd/web …`; one root ESLint
config, root `vitest.config.ts` (`test.projects`: web, domain, scripts), `tsconfig.base.json` shared.
`.env*` files stay at the root (Vite `envDir`). The app lives in `apps/web/` (package
`@epd/web`: `index.html`, Vite/Vitest/Playwright configs, `src/`, `e2e/`). Folder convention:
Bulletproof React. Paths below under `src/` are `apps/web/src/`.

- `packages/domain/` — `@epd/domain`, pure TypeScript (model, defaults, geometry, lengths, routing,
  BOM, checks, quote, built-in catalog); source-only, imported as `@epd/domain/<module>` (no barrel);
  its tests run in the `node` environment
- `src/app/` — entry (`main.tsx`), `provider.tsx`, `router.tsx` (routes), `layouts/` (AppShell,
  MobileShell, ProjectFrame, RequireAuth), `routes/`, `styles.css`
- `src/features/<name>/` — UI by feature (auth, projects, editor, panel, circuits, catalog, bom,
  checks, quote, exports, mobile, profile, settings), split into `components/`, `hooks/`,
  `utils/` (and `api/`) as needed
- `src/components/` — shared UI: `ui/` (Radix-based components, number input), `symbols/`
- `src/hooks/` — hooks shared by several features (e.g. `useAnalysis`)
- `src/lib/` — `repositories/` (repository interfaces + Supabase and in-memory implementations,
  provider; the only place that talks to Supabase), `auth/`, `i18n/` (`locales/en.json` base,
  `it.json`), formatting, colors, download, BOM/check descriptions, view mode
- `src/stores/editor/` — editor store (zustand + immer patches), undo/redo, autosave
- `src/config/env.ts` — zod-validated Vite env
- `supabase/` — config, migrations, generated seed (local stack)
- `scripts/` — `check-env.mjs`, `env-local.mjs`, `build-seed.mjs`
- `src/testing/` — `setup.ts` (Vitest), `renderApp.tsx` (component tests), `editor.ts` (store
  helpers), `pdfText.ts` (PDF text via pdfjs, Node env)
- `apps/web/e2e/` — Playwright specs + `helpers.ts` (`fixture(name)` resolves `tests/fixtures`)
- `tests/fixtures/` — shared fixtures at the repo root (domain, web, seed and its test)

## Conventions

- Everything in the repo is English. User-facing strings only via i18n keys
  (`t('...')`); ESLint `i18next/no-literal-string` enforces it in `.tsx` files of `src/app`,
  `src/components`, `src/features`, `src/lib`.
  Every key must exist in both `en.json` and `it.json` (test enforces).
- Dependency rule: `app → features → stores → domain`, `features/stores → lib → domain`,
  `features → components`. `@epd/domain` imports nothing from the app (ESLint enforced).
- Import alias `@/` = `src/`. Components get persistence only via `useRepositories()`
  (`src/lib/repositories/types.ts`); component tests use `renderApp()` from `src/testing/renderApp.tsx`
  (real routes + in-memory repositories, seeded like `supabase/seed.sql`).
- Tests sit next to the code (`*.test.ts(x)`); each test carries a card comment
  `// protects=...; fails_when=...; no_claim=...`.
- Lengths are integer millimeters inside the domain; meters only at the edges. Money is integer
  cents.
- PDFs (jsPDF, built-in Helvetica) must only contain WinAnsi characters (no `→`, emoji);
  PDF tests run with `// @vitest-environment node`.
- Mobile view (< 768 px) is chosen once per tab session (`sessionStorage` `epd.viewMode`).
- jsdom has no canvas: `src/testing/setup.ts` stubs `react-konva`, so canvas behavior is
  tested in Playwright, driving the store through `window.__epd` (`apps/web/e2e/helpers.ts`).
- Env modes: `.env.memory` (`dev:mem`), `.env.e2e` (exposes `window.__epd` test handle).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- `useEditor(selector)` must return stable references: select raw store fields and derive
  arrays with `useMemo`, never `.filter()/.map()` inside the selector (render loop).
