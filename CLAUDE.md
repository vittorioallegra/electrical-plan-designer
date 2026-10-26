# Electrical Plan Designer

Backend-free web app (installable PWA) for electricians: floor plan, panel, circuits through
conduits, BOM, checks, PDF/CSV exports and quotes. A project is one `.epd` file; the open
project is kept as a draft in IndexedDB. Spec: docs/specs/electrical-plan-designer.md; plan
and decisions: docs/plans/local-first.md; deploy: docs/deploy.md.

## Commands

Node 24 via nvm (`export PATH=~/.nvm/versions/node/v24.22.1/bin:$PATH` if `node` is
missing), pnpm 12. No Docker, backend or env vars needed.

- `pnpm setup` — install dependencies and Playwright's Chromium
- `pnpm dev` — dev server on :5173
- `pnpm build` — typecheck, then the static site in `apps/web/dist` (PWA via vite-plugin-pwa)
- `pnpm typecheck` (TypeScript 7 via the `typescript7` alias; `typescript` stays 6.0 for
  typescript-eslint) / `pnpm lint` / `pnpm format`
- `pnpm test` — Vitest (projects: web/jsdom, domain/node, repo). Quiet, failures only:
  `pnpm exec vitest run --reporter=dot --silent`. One file, from the root:
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot` (one test: `-t "riser"`)
- `pnpm test:e2e` — Playwright (`apps/web/e2e`): dev server on :5174 in `e2e` mode, plus a
  production build on :5175 for `offline.spec.ts`; quiet: `pnpm test:e2e --reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:e2e (the gate; no CI yet)
- `pnpm demo:epd` — regenerate `tests/fixtures/demo-project.epd` (drawing from
  `demo-project.json`, business data in `scripts/build-demo-epd.mjs`; a unit test checks drift)

## Layout

pnpm workspace (Bulletproof React folders). Root: scripts proxying to `pnpm --filter @epd/web`,
one ESLint config, `vitest.config.ts` (projects), `tsconfig.base.json`, `.env*` (Vite `envDir`).
`src/` = `apps/web/src/` (package `@epd/web`: Vite/Vitest/Playwright configs, `e2e/`, `public/`
with icons and the static-host `_headers`/`_redirects`).

- `packages/domain/` — `@epd/domain`: pure TS (model, geometry, lengths, routing, BOM, checks,
  quotes, catalogs with CSV/`.epc` import, `.epd` project file schema and migrations);
  source-only, imported as `@epd/domain/<module>`, no barrel
- `src/app/` — `main.tsx`, `provider.tsx`, `router.tsx` (`createRoutes()`), `layouts/`, `routes/`
- `src/features/<name>/` — start, editor, panel, circuits, catalog, company, bom, checks, quote,
  exports, settings; sub-folders `components/ hooks/ utils/` as needed
- `src/api/keys.ts` (query keys), `src/components/` (`ui/`, `symbols/`), `src/hooks/` (shared;
  `useCatalog` reads catalogs, prices, presets, company of the open project), `src/config/`
- `src/lib/` — `repositories/` (`types.ts`; `drafts.ts` IndexedDB draft; `fileAccess.ts` file
  input to open, download to save, in-memory fake; `draftPresence.ts` which tab may write the
  draft, over BroadcastChannel; `idb.ts`), `i18n/` (`locales/en.json` base,
  `it.json`), `projectFile/` (`.epd` zip read/write with `fflate`), formatting helpers
- `src/stores/editor/` — `workspace.ts` (the tab's one open project), editor store
  (`ProjectFile` and assets, zustand + immer patches), undo/redo, autosave to the draft
- `src/testing/` (`renderApp`, `editor`, `pdfText`, setup), `scripts/` (build-demo-epd),
  `tests/fixtures/` (shared; e2e uses `fixture(name)`), `tests/lint/` (lint rule tests)

## Conventions

- Repo in English; UI strings only via `t('...')` (`i18next/no-literal-string` on `.tsx` in
  `app`, `components`, `features`, `lib`); every key in both `en.json` and `it.json` (tested).
  Some keys are used only inside other strings (`$t(counts.…)`).
- Imports (ESLint): features never import other features; shared folders (`api`, `components`,
  `config`, `hooks`, `lib`, `stores`) never import `features` or `app`; `testing` may import
  `app`; no barrels; `@epd/domain` imports nothing from the app. Alias `@/` = `src/`.
- Data: the open project lives in the workspace's editor store; every change goes through
  `applyCommand` (undoable; issuing a quote is the one exception) and autosave writes the draft.
  Services (`drafts`, `fileAccess`, `workspace`) come from `useEditorServices()`. TanStack Query
  only for local async reads (draft, its holder tab, images), never `useEffect` fetches.
- Routes: `/` start screen; `/project/<view>` shows the open project (none → `/`); every route
  has an `ErrorBoundary`; editor, canvas and PDF code are lazy. `renderApp(path)` opens the demo
  project for `/project/...` paths (`project: null` to skip) and waits for the first navigation.
- Tests next to the code, each with a card comment `// protects=...; fails_when=...; no_claim=...`.
- File formats: `.epd` has two versions, `manifest.schemaVersion` (project.json,
  `projectFile/migrations.ts`) and `doc.schemaVersion` (drawing, `load.ts`); `.epc` has its
  own. Before the first release they stay at 1 and change in place (update
  `projectFile/fixtures/v1.json`, run `pnpm demo:epd`). After it, every schema change bumps
  the version, adds a pure migration with a test, and freezes a fixture of the previous
  version: old files must always open, newer ones are refused.
- Lengths: integer mm in the domain, meters at the edges. Money: integer cents.
- PDFs (jsPDF Helvetica) use WinAnsi characters only; PDF tests run in `@vitest-environment node`.
- jsdom has no canvas (setup stubs `react-konva`): canvas behavior is tested in Playwright via
  `window.__epd.store` (dev and `.env.e2e`). E2E builds use in-memory files
  (`window.__epd.files`; helpers `offerFixture`, `savedBytes`); `window.__epdRealFiles` set by
  an init script switches to the real file access.
- `useEditor(selector)` returns raw store fields; derive arrays with `useMemo` (render loop).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
