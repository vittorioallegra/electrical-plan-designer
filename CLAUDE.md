# Electrical Plan Designer

Electron desktop app (macOS, Windows; no backend) for electricians: floor plan, panel, circuits,
BOM, checks, PDF/CSV exports, quotes. A project is one `.epd` file. Specs and plans:
docs/specs/{electrical-plan-designer,desktop-app}.md, docs/plans/{local-first,desktop-app}.md;
release: docs/release.md.

## Commands

Node 24 via nvm (`export PATH=~/.nvm/versions/node/v24.22.1/bin:$PATH` if `node` is
missing), pnpm 12. No Docker, backend or env vars needed.

- `pnpm setup` — install dependencies and Playwright's Chromium
- `pnpm dev` — the renderer alone in a browser on :5173 (in-memory fakes; development only)
- `pnpm desktop:dev` — Electron on the Vite dev server (:5173, stop `pnpm dev` first)
- `pnpm desktop:build` — typecheck, then the unpacked app in `apps/desktop/release`;
  `pnpm --filter @epd/desktop dist` — the installers (dmg, NSIS; docs/release.md)
- `pnpm typecheck` (TS 7 via the `typescript7` alias; `typescript` 6.0 stays for
  typescript-eslint) / `pnpm lint` / `pnpm format`
- `pnpm test` — Vitest (projects: web/jsdom, domain/node, desktop/node, repo). Quiet, failures
  only: `pnpm exec vitest run --reporter=dot --silent`. One file, from the root:
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot` (one test: `-t "riser"`)
- `pnpm test:e2e` — browser Playwright (`apps/web/e2e`, dev server :5174 in `e2e` mode); quiet:
  `pnpm test:e2e --reporter=dot`
- `pnpm test:e2e:desktop` — builds `apps/desktop/out`, then Playwright drives the real Electron
  app (`apps/desktop/e2e`, temp `userData`); quiet: add `--reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:e2e, test:e2e:desktop (CI: `.github/workflows/desktop.yml`)
- `pnpm demo:epd` — regenerate `tests/fixtures/demo-project.epd` (from `demo-project.json` and
  `scripts/build-demo-epd.mjs`; a unit test checks drift)

## Layout

pnpm workspace (Bulletproof React folders). Root: one ESLint config, `vitest.config.ts`
(projects), `tsconfig.base.json`, `.env*` (Vite `envDir`). `src/` = `apps/web/src/` (`@epd/web`,
the renderer: Vite/Vitest/Playwright configs, `e2e/`).

- `apps/desktop/` — `@epd/desktop`: Electron shell. `src/main` (window, `app://` scheme + CSP,
  `files.ts` dialogs and atomic writes, `recovery.ts` `userData/recovery/`, `library.ts`
  `userData/library/`, `menu.ts` native menu, `recent.ts`, `openRequests.ts` files the OS opens),
  `src/preload` (`window.epd`), `e2e/`, `build/` icons; electron-vite builds main, preload and the
  renderer (apps/web source); `electron-builder.yml` (macOS ad-hoc signed, no Developer ID)
- `packages/bridge/` — `@epd/bridge`: IPC contract (`EpdBridge`, channels), types only
- `packages/domain/` — `@epd/domain`: pure TS (model, geometry, lengths, routing, BOM, checks,
  quotes, library, catalogs with CSV/`.epc` import, `.epd` schema and migrations);
  source-only, imported as `@epd/domain/<module>`, no barrel
- `src/app/` — `main.tsx`, `provider.tsx`, `router.tsx` (`createRoutes()`), `layouts/`, `routes/`
- `src/features/<name>/` — start, editor, panel, circuits, library, bom, checks, quote, exports,
  settings; sub-folders `components/ hooks/ utils/`
- `src/api/keys.ts` (query keys), `src/components/` (`ui/`, `symbols/`, shared forms),
  `src/hooks/` (`useCatalog` = project copies, `useItemsOf` = pickers), `src/config/`
- `src/lib/` — `repositories/` (`types.ts`, `fileAccess.ts`, `recovery.ts`, `library.ts`,
  `windowHost.ts`; over `window.epd` or an in-memory fake), `i18n/` (`locales/en.json` base,
  `it.json`), `projectFile/` (`.epd` zip), `libraryFile/` (`.epl` zip), formatting helpers
- `src/stores/editor/` — `workspace.ts` (the window's one open project), editor store
  (`ProjectFile` + assets, zustand + immer), undo/redo, autosave to the recovery copy;
  `src/stores/library/` — the app library
- `src/testing/` (`renderApp`, `editor`, `pdfText`, setup), `scripts/`, `tests/fixtures/`
  (shared; e2e `fixture(name)`), `tests/lint/`

## Conventions

- Design system: read DESIGN.md before any UI work (tokens, fonts, components); ask before
  departing from it, and flag UI code that does not match it in reviews.
- Repo in English; UI strings only via `t('...')` (`i18next/no-literal-string` on `.tsx` in
  `app`, `components`, `features`, `lib`); every key in both `en.json` and `it.json` (tested).
- Imports (ESLint): features never import other features; shared folders (`api`, `components`,
  `config`, `hooks`, `lib`, `stores`) never import `features` or `app`; no barrels;
  `@epd/domain` imports nothing from the app. Alias `@/` = `src/`.
- Data: the open project lives in the workspace's editor store; every change goes through
  `applyCommand` (undoable; issuing a quote is the exception). The library store is loaded
  before the first route and is not undoable. A project holds only `items` and `cablePrices`
  (copies of what it uses); BOM, checks and quotes read those, never the library (only "Update
  from library" pulls changes in). Services (`recovery`, `fileAccess`, `windowHost`, `workspace`,
  `library`) come from `useEditorServices()`. TanStack Query only for local async reads.
- Routes: `/` start; `/library/<section>` (project stays open); `/project/<view>` (none → `/`);
  every route has an `ErrorBoundary`; editor, canvas and PDF code are lazy. `renderApp(path)`
  opens the demo project for `/project/...` (`project: null` to skip).
- Tests sit next to the code, each with a card comment `// protects=...; fails_when=...; no_claim=...`.
- File formats: `.epd` has `manifest.schemaVersion` (`projectFile/migrations.ts`) and
  `doc.schemaVersion` (`load.ts`); `.epc` and the library have their own. Before the first
  release they stay at 1 and change in place (update `projectFile/fixtures/v1.json`, run
  `pnpm demo:epd`). After it, every schema change bumps the version, adds a pure migration with
  a test and freezes a fixture of the previous version: old files open, newer ones are refused.
- Lengths: integer mm in the domain, meters at the edges. Money: integer cents. PDFs (jsPDF
  Helvetica) use WinAnsi characters only; PDF tests run in `@vitest-environment node`.
- jsdom has no canvas: canvas behavior is tested in the browser E2E via `window.__epd.store`.
  Browser E2E (no `window.epd`) uses in-memory files (`window.__epd.files`, `.library`); real
  files are tested in the Electron E2E, where native dialogs are stubbed in main.
- Save writes the bound path in place (no path: Save As); exports go through `useExportFile`.
- `useEditor(selector)` returns raw store fields; derive arrays with `useMemo` (render loop).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
