# Electrical Plan Designer

Backend-free app (PWA, becoming an Electron desktop app) for electricians: floor plan, panel,
circuits, BOM, checks, PDF/CSV exports, quotes. A project is one `.epd` file. Specs and plans:
docs/specs/{electrical-plan-designer,desktop-app}.md, docs/plans/{local-first,desktop-app}.md;
deploy: docs/deploy.md.

## Commands

Node 24 via nvm (`export PATH=~/.nvm/versions/node/v24.22.1/bin:$PATH` if `node` is
missing), pnpm 12. No Docker, backend or env vars needed.

- `pnpm setup` — install dependencies and Playwright's Chromium
- `pnpm dev` — dev server :5173; `pnpm build` — typecheck, then the PWA site in `apps/web/dist`
- `pnpm typecheck` (TS 7 via the `typescript7` alias; `typescript` 6.0 stays for
  typescript-eslint) / `pnpm lint` / `pnpm format`
- `pnpm test` — Vitest (projects: web/jsdom, domain/node, desktop/node, repo). Quiet, failures
  only: `pnpm exec vitest run --reporter=dot --silent`. One file, from the root:
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot` (one test: `-t "riser"`)
- `pnpm test:e2e` — Playwright (`apps/web/e2e`): dev server :5174 in `e2e` mode, production
  build :5175 for `offline.spec.ts`; quiet: `pnpm test:e2e --reporter=dot`
- `pnpm desktop:dev` — Electron on the Vite dev server (:5173, stop `pnpm dev` first);
  `pnpm desktop:build` — typecheck, then the unpacked, unsigned app in `apps/desktop/release`
- `pnpm test:e2e:desktop` — builds `apps/desktop/out`, then Playwright drives the real Electron
  app (`apps/desktop/e2e`, temp `userData`); quiet: add `--reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:e2e, test:e2e:desktop (the gate; no CI yet)
- `pnpm demo:epd` — regenerate `tests/fixtures/demo-project.epd` (from `demo-project.json` and
  `scripts/build-demo-epd.mjs`; a unit test checks drift)

## Layout

pnpm workspace (Bulletproof React folders). Root: scripts proxying to `pnpm --filter @epd/web`,
one ESLint config, `vitest.config.ts` (projects), `tsconfig.base.json`, `.env*` (Vite `envDir`).
`src/` = `apps/web/src/` (`@epd/web`: Vite/Vitest/Playwright configs, `e2e/`, `public/`).

- `apps/desktop/` — `@epd/desktop`: Electron shell. `src/main` (window, `app://` scheme serving
  the built renderer, CSP, `files.ts` dialogs + atomic writes, `atomicWrite.ts` shared by Save and
  the recovery copy, `recovery.ts` the `userData/recovery/` copy, `library.ts` the
  `userData/library/` files, `menu.ts`/`appMenu.ts` the native menu with labels sent by the
  renderer, `recent.ts` `userData/recent.json`, `openRequests.ts` files the OS asks to open),
  `src/preload` (exposes `window.epd`), `e2e/`; electron-vite builds main, preload and the
  renderer (apps/web source, no PWA, base `/`); electron-builder packs
- `packages/bridge/` — `@epd/bridge`: IPC contract (`EpdBridge`, channels), types only
- `packages/domain/` — `@epd/domain`: pure TS (model, geometry, lengths, routing, BOM, checks,
  quotes, catalogs with CSV/`.epc` import, `.epd` project file schema and migrations);
  source-only, imported as `@epd/domain/<module>`, no barrel
- `src/app/` — `main.tsx`, `provider.tsx`, `router.tsx` (`createRoutes()`), `layouts/`, `routes/`
- `src/features/<name>/` — start, editor, panel, circuits, library (company, catalog, presets,
  defaults), bom, checks, quote, exports, settings; sub-folders `components/ hooks/ utils/`
- `src/api/keys.ts` (query keys), `src/components/` (`ui/`, `symbols/`, forms shared by project
  and library pages), `src/hooks/` (shared; `useCatalog` = project copies, `useItemsOf` = pickers), `src/config/`
- `src/lib/` — `repositories/` (`types.ts`; `recovery.ts`, `fileAccess.ts` (open, save in place,
  saveAs, exportFile), `library.ts`, `windowHost.ts`; over `window.epd` or an in-memory fake),
  `i18n/` (`locales/en.json` base, `it.json`), `projectFile/` (`.epd` zip, `fflate`),
  `libraryFile/` (`.epl` zip), formatting helpers
- `src/stores/editor/` — `workspace.ts` (the window's one open project), editor store
  (`ProjectFile` and assets, zustand + immer patches), undo/redo, autosave to the recovery copy
  (cleared once the file has every change or on "Don't save"); `src/stores/library/` — the app library
- `src/testing/` (`renderApp`, `editor`, `pdfText`, setup), `scripts/` (build-demo-epd),
  `tests/fixtures/` (shared; e2e `fixture(name)`), `tests/lint/` (lint rule tests)

## Conventions

- Repo in English; UI strings only via `t('...')` (`i18next/no-literal-string` on `.tsx` in
  `app`, `components`, `features`, `lib`); every key in both `en.json` and `it.json` (tested).
  Some keys only appear inside other strings (`$t(counts.…)`).
- Imports (ESLint): features never import other features; shared folders (`api`, `components`,
  `config`, `hooks`, `lib`, `stores`) never import `features` or `app`; `testing` may import
  `app`; no barrels; `@epd/domain` imports nothing from the app. Alias `@/` = `src/`.
- Data: the open project lives in the workspace's editor store; every change goes through
  `applyCommand` (undoable; issuing a quote is the one exception) and autosave writes the recovery copy.
  The library store (`useLibrary`, `apply(recipe)`) is loaded before the first route, writes
  through one file per change and is not undoable. A project holds only `items` and `cablePrices`
  (copies of what it uses, kept by `copyUsedItems` in `applyCommand`); BOM, checks and quotes read
  those, never the library; a quote price edit writes only them. Services (`recovery`, `fileAccess`,
  `windowHost`, `workspace`, `library`) come from `useEditorServices()`.
  TanStack Query only for local async reads (the recovery copy, images), never `useEffect` fetches.
- Routes: `/` start; `/library/<section>` (project stays open); `/project/<view>` (none → `/`);
  every route has an `ErrorBoundary`; editor, canvas and PDF code are lazy. `renderApp(path)` opens the demo
  project for `/project/...` paths (`project: null` to skip) and waits for the first navigation.
- Tests sit next to the code, each with a card comment `// protects=...; fails_when=...; no_claim=...`.
- File formats: `.epd` has two versions, `manifest.schemaVersion` (project.json,
  `projectFile/migrations.ts`) and `doc.schemaVersion` (drawing, `load.ts`); `.epc` and the library (`library.json`
  `schemaVersion`, also in `.epl`) have their own. Before the first release they stay at 1 and change in place (update
  `projectFile/fixtures/v1.json`, run `pnpm demo:epd`). After it, every schema change bumps
  the version, adds a pure migration with a test, and freezes a fixture of the previous
  version: old files must always open, newer ones are refused.
- Lengths: integer mm in the domain, meters at the edges. Money: integer cents. PDFs (jsPDF
  Helvetica) use WinAnsi characters only; PDF tests run in `@vitest-environment node`.
- jsdom has no canvas (setup stubs `react-konva`): canvas behavior is tested in Playwright via
  `window.__epd.store` (dev and `.env.e2e`). Browser E2E (no `window.epd`) uses in-memory files
  (`window.__epd.files`, `.library`; helpers `offerFixture`, `savedBytes`); real files are tested in the
  Electron E2E, where native dialogs are stubbed in main (`stubOpenDialog`).
- Files: Save writes the bound path (`store.file`) in place; no path means Save As. Exports go
  through `useExportFile`, never an anchor download. Main writes only paths it handed out and
  validates every IPC argument and sender.
- `useEditor(selector)` returns raw store fields; derive arrays with `useMemo` (render loop).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
