# Electrical Plan Designer

Web app for electricians, backend-free: draw a residential electrical system on a floor plan,
design the panel, route circuits through conduits, and get a computed BOM, checks, PDF/CSV
exports and a quote. A project is one `.epd` file; the open project is kept as a draft in
IndexedDB. Spec and plans: docs/specs/electrical-plan-designer.md, docs/plans/local-first.md.

## Commands

Node 24 via nvm (`export PATH=~/.nvm/versions/node/v24.22.1/bin:$PATH` if `node` is
missing), pnpm 12. No Docker or backend needed.

- `pnpm setup` — install dependencies and Playwright's Chromium
- `pnpm dev` — dev server on :5173
- `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm format`. `typecheck` runs TypeScript 7
  (`typescript7` npm alias); `typescript` stays 6.0 because typescript-eslint needs its API
- `pnpm test` — Vitest (projects: web/jsdom, domain/node, repo). Quiet, failures only:
  `pnpm exec vitest run --reporter=dot --silent`. One file, from the root:
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot` (one test: `-t "riser"`)
- `pnpm test:e2e` — Playwright (`apps/web/e2e`, own Vite server on :5174 in `e2e` mode);
  quiet: `pnpm test:e2e --reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:e2e (the gate; no CI yet)
- `pnpm demo:epd` — regenerate `tests/fixtures/demo-project.epd` (drawing from
  `demo-project.json`, business data in `scripts/build-demo-epd.mjs`; a unit test checks drift)

## Layout

pnpm workspace (Bulletproof React folders). Root: scripts proxying to `pnpm --filter @epd/web`,
one ESLint config, `vitest.config.ts` (projects), `tsconfig.base.json`, `.env*` (Vite `envDir`).
Below, `src/` = `apps/web/src/` (package `@epd/web`: Vite/Vitest/Playwright configs, `e2e/`).

- `packages/domain/` — `@epd/domain`: pure TS (model, geometry, lengths, routing, BOM, checks,
  quote and issued quotes, catalogs with CSV/`.epc` import, `.epd` project file schema);
  source-only, imported as `@epd/domain/<module>`, no barrel
- `src/app/` — `main.tsx`, `provider.tsx`, `router.tsx` (`createRoutes()`), `layouts/`,
  `routes/` (route modules composing features)
- `src/features/<name>/` — start, editor, panel, circuits, catalog, company, bom, checks, quote,
  exports, settings; sub-folders `components/ hooks/ utils/` as needed
- `src/api/keys.ts` (TanStack Query keys), `src/components/` (`ui/`, `symbols/`), `src/hooks/`
  (shared hooks; `useCatalog` reads catalogs, prices, box presets and company from the open
  project), `src/config/` (env, version)
- `src/lib/` — `repositories/` (`types.ts`; `drafts.ts` IndexedDB draft; `fileAccess.ts` File
  System Access, download fallback and in-memory fake; `idb.ts`), `i18n/` (`locales/en.json`
  base, `it.json`), `projectFile/` (`.epd` zip read/write, `fflate`), formatting helpers
- `src/stores/editor/` — `workspace.ts` (the tab's one open project), editor store
  (`ProjectFile` and assets, zustand + immer patches), undo/redo, autosave to the draft
- `src/testing/` — `setup.ts`, `renderApp.tsx`, `editor.ts`, `pdfText.ts`
- `scripts/` (build-demo-epd), `tests/fixtures/` (shared fixtures; e2e uses `fixture(name)`),
  `tests/lint/` (lint rule tests)

## Conventions

- Repo in English; UI strings only via `t('...')` (`i18next/no-literal-string` on `.tsx` in
  `app`, `components`, `features`, `lib`); every key in both `en.json` and `it.json` (tested).
  Some keys are only used inside other strings (`$t(counts.…)`).
- Imports (ESLint): features never import other features; the shared folders (`api`,
  `components`, `config`, `hooks`, `lib`, `stores`) never import `features` or `app`; `testing`
  may import `app`; no `index.ts` barrels; `@epd/domain` imports nothing from the app. Shared
  code moves to a shared folder, or `src/app` composes features. Alias `@/` = `src/`.
- Data: the open project lives in the workspace's editor store; every change goes through
  `applyCommand` (undoable) and autosave writes the draft. Services (`drafts`, `fileAccess`,
  `workspace`) come from `useEditorServices()`. TanStack Query only for local async reads
  (draft, recent files, decoded images), never `useEffect` fetches; no retries or refetch on focus.
- Routes: `/` start screen; `/project/<view>` shows the open project (none → `/`); every route
  has an `ErrorBoundary` (`components/ui/RouteError`); editor, canvas and PDF code are lazy.
  `renderApp(path)` (real routes, in-memory draft and files) opens the demo project for
  `/project/...` paths (`project: null` to skip) and waits for the first navigation.
- Tests next to the code, each with a card comment `// protects=...; fails_when=...; no_claim=...`.
- Project file schema: no migrations before the first release (versions stay 1; update
  `projectFile/fixtures/v1.json` and run `pnpm demo:epd`). After it, each change bumps the
  version, adds a migration (`projectFile/migrations.ts`) and freezes a previous-version fixture.
- Lengths: integer mm in the domain, meters at the edges. Money: integer cents.
- PDFs (jsPDF Helvetica) use WinAnsi characters only; PDF tests run in `@vitest-environment node`.
- jsdom has no canvas (`src/testing/setup.ts` stubs `react-konva`): canvas behavior is tested
  in Playwright via `window.__epd.store` (exposed in dev and with `.env.e2e`). E2E builds open
  and save through an in-memory fake (`window.__epd.files`; helpers `offerFixture`,
  `savedBytes`); an init script setting `window.__epdRealFiles` uses the real file access.
- `useEditor(selector)` returns raw store fields; derive arrays with `useMemo` (render loop).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
