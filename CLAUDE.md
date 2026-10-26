# Electrical Plan Designer

Backend-free web app (installable PWA) for electricians: floor plan, panel, circuits through
conduits, BOM, checks, PDF/CSV exports and quotes. A project is one `.epd` file; the open
while it is open, autosave keeps a recovery copy in the app data folder (desktop app). Spec: docs/specs/electrical-plan-designer.md; plan
and decisions: docs/plans/local-first.md; deploy: docs/deploy.md.

## Commands

Node 24 via nvm (`export PATH=~/.nvm/versions/node/v24.22.1/bin:$PATH` if `node` is
missing), pnpm 12. No Docker, backend or env vars needed.

- `pnpm setup` — install dependencies and Playwright's Chromium
- `pnpm dev` — dev server on :5173
- `pnpm build` — typecheck, then the static site in `apps/web/dist` (PWA via vite-plugin-pwa)
- `pnpm typecheck` (TypeScript 7 via the `typescript7` alias; `typescript` stays 6.0 for
  typescript-eslint) / `pnpm lint` / `pnpm format`
- `pnpm test` — Vitest (projects: web/jsdom, domain/node, desktop/node for `apps/desktop/src/main`, repo). Quiet, failures only:
  `pnpm exec vitest run --reporter=dot --silent`. One file, from the root:
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot` (one test: `-t "riser"`)
- `pnpm test:e2e` — Playwright (`apps/web/e2e`): dev server on :5174 in `e2e` mode, plus a
  production build on :5175 for `offline.spec.ts`; quiet: `pnpm test:e2e --reporter=dot`
- `pnpm desktop:dev` — Electron shell on the Vite dev server (:5173, so stop `pnpm dev` first)
- `pnpm desktop:build` — typecheck, then the unpacked desktop app for this OS in `apps/desktop/release`
  (unsigned)
- `pnpm test:e2e:desktop` — builds `apps/desktop/out`, then Playwright drives the real Electron
  app (`apps/desktop/e2e`, `_electron.launch`, temp `userData`); quiet: add `--reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:e2e, test:e2e:desktop (the gate; no CI yet)
- `pnpm demo:epd` — regenerate `tests/fixtures/demo-project.epd` (drawing from
  `demo-project.json`, business data in `scripts/build-demo-epd.mjs`; a unit test checks drift)

## Layout

pnpm workspace (Bulletproof React folders). Root: scripts proxying to `pnpm --filter @epd/web`,
one ESLint config, `vitest.config.ts` (projects), `tsconfig.base.json`, `.env*` (Vite `envDir`).
`src/` = `apps/web/src/` (package `@epd/web`: Vite/Vitest/Playwright configs, `e2e/`, `public/`
with icons and the static-host `_headers`/`_redirects`).

- `apps/desktop/` — `@epd/desktop`: Electron shell. `src/main` (window, `app://` scheme serving
  the built renderer, CSP, `files.ts` dialogs + atomic writes, `atomicWrite.ts` shared by Save and
  the recovery copy, `recovery.ts` the `userData/recovery/` copy), `src/preload` (exposes `window.epd`), `e2e/`; electron-vite builds
  main, preload and the renderer (apps/web source, no PWA, base `/`); electron-builder packs
- `packages/bridge/` — `@epd/bridge`: IPC contract (`EpdBridge`, channel names), types only;
  imported by desktop main/preload and the web app, imports nothing from the apps
- `packages/domain/` — `@epd/domain`: pure TS (model, geometry, lengths, routing, BOM, checks,
  quotes, catalogs with CSV/`.epc` import, `.epd` project file schema and migrations);
  source-only, imported as `@epd/domain/<module>`, no barrel
- `src/app/` — `main.tsx`, `provider.tsx`, `router.tsx` (`createRoutes()`), `layouts/`, `routes/`
- `src/features/<name>/` — start, editor, panel, circuits, catalog, company, bom, checks, quote,
  exports, settings; sub-folders `components/ hooks/ utils/` as needed
- `src/api/keys.ts` (query keys), `src/components/` (`ui/`, `symbols/`), `src/hooks/` (shared;
  `useCatalog` reads catalogs, prices, presets, company of the open project), `src/config/`
- `src/lib/` — `repositories/` (`types.ts`; `recovery.ts` recovery copy of the open project;
  `fileAccess.ts` path-based files (open, save in place, saveAs, exportFile); both over
  `window.epd` or an in-memory fake; `windowHost.ts` title state and close question), `i18n/` (`locales/en.json` base,
  `it.json`), `projectFile/` (`.epd` zip read/write with `fflate`), formatting helpers
- `src/stores/editor/` — `workspace.ts` (the window's one open project), editor store
  (`ProjectFile` and assets, zustand + immer patches), undo/redo, autosave to the recovery copy
  (cleared once the file has every change or on "Don't save")
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
  `applyCommand` (undoable; issuing a quote is the one exception) and autosave writes the recovery copy.
  Services (`recovery`, `fileAccess`, `windowHost`, `workspace`) come from `useEditorServices()`.
  TanStack Query only for local async reads (the recovery copy, images), never `useEffect` fetches.
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
  `window.__epd.store` (dev and `.env.e2e`). Browser E2E (no `window.epd`) uses in-memory files
  (`window.__epd.files`; helpers `offerFixture`, `savedBytes`); real files are tested in the
  Electron E2E, where native dialogs are stubbed in main (`stubOpenDialog`).
- Files: Save writes the bound path (`store.file`) in place; no path means Save As. Every
  export goes through `useExportFile`/`fileAccess.exportFile`, never an anchor download.
  Main writes only paths it handed out and validates every IPC argument and sender.
- `useEditor(selector)` returns raw store fields; derive arrays with `useMemo` (render loop).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
