# Electrical Plan Designer

Electron desktop app (macOS, Windows; no backend) for electricians: floor plan, panel, circuits,
BOM, checks, PDF/CSV exports, quotes. A project is one `.epd` file. Specs and plans in
docs/specs/ and docs/plans/ (desktop-app, local-first, ui-redesign); release: docs/release.md.

## Commands

Node 24 via nvm (`export PATH=~/.nvm/versions/node/v24.22.1/bin:$PATH` if `node` is missing),
pnpm 12. No Docker, backend or env vars needed.

- `pnpm setup` — install dependencies and Playwright's Chromium
- `pnpm dev` — the renderer alone in a browser on :5173 (in-memory fakes; development only)
- `pnpm desktop:dev` — Electron on the Vite dev server (:5173, stop `pnpm dev` first)
- `pnpm desktop:build` — typecheck, then the unpacked app in `apps/desktop/release`;
  `pnpm --filter @epd/desktop dist` — the installers (dmg, NSIS; docs/release.md)
- `pnpm typecheck` (TS 7 via the `typescript7` alias) / `pnpm lint` / `pnpm format`
- `pnpm test` — Vitest (projects: web/jsdom, domain/node, desktop/node, repo). Quiet:
  `pnpm exec vitest run --reporter=dot --silent`; one file:
  `pnpm exec vitest run packages/domain/src/lengths.test.ts --reporter=dot` (one test: `-t "riser"`)
- `pnpm test:e2e` — browser Playwright (`apps/web/e2e`, dev server :5174); quiet: `--reporter=dot`
- `pnpm test:e2e:desktop` — builds `apps/desktop/out`, Playwright drives the real Electron app
  (`apps/desktop/e2e`, temp `userData`); quiet: `--reporter=dot`
- `pnpm verify` — typecheck, lint, test, test:e2e, test:e2e:desktop (CI: `.github/workflows/desktop.yml`)
- `pnpm demo:epd` — regenerate `tests/fixtures/demo-project.epd` (a unit test checks drift)

## Layout

pnpm workspace (Bulletproof React folders). `src/` = `apps/web/src/` (`@epd/web`, the renderer).

- `apps/desktop/` — Electron shell: `src/main` (window, `app://` + CSP, `files.ts` dialogs and
  atomic writes, `recovery.ts`, `library.ts`, `preferences.ts` theme, `menu.ts`, `recent.ts`,
  `openRequests.ts`), `src/preload` (`window.epd`), `e2e/`, `build/` icons, `electron-builder.yml`
- `packages/bridge/` — IPC contract (`EpdBridge`, channels), types only
- `packages/domain/` — pure TS (model, geometry, routing, BOM, checks, quotes, library, catalogs,
  `.epd` schema and migrations); imported as `@epd/domain/<module>`, no barrel
- `src/app/` — `main.tsx`, `provider.tsx`, `router.tsx`, `layouts/`, `routes/`, `styles.css` (tokens)
- `src/features/<name>/` — start, editor, panel, circuits, app-settings (Settings screen), bom,
  checks, quote, exports, project-details (per-project view); `components/ hooks/ utils/`
- `src/components/` (`ui/` kit, `symbols/`, shared forms), `src/hooks/`, `src/api/keys.ts`, `src/config/`
- `src/lib/` — `repositories/` (over `window.epd` or an in-memory fake), `i18n/` (`en.json` base,
  `it.json`), `projectFile/` (`.epd` zip), `libraryFile/` (`.epl` zip), `theme/`, `platform.ts`
- `src/stores/editor/` — `workspace.ts` (the window's open project), editor store (zustand +
  immer), undo/redo, autosave to the recovery copy; `src/stores/library/` — the app library
- `src/testing/`, `scripts/`, `tests/fixtures/`, `tests/lint/` (boundaries, colour literals),
  `tests/design/` (DESIGN.md tokens, contrast)

## Conventions

- UI: read DESIGN.md first; ask before departing from it and flag mismatches in reviews. Colours
  only via tokens in `styles.css` (the canvas reads `canvas-*`). Controls come from
  `components/ui` (Radix + tokens): no native `<select>` (`ui/Select`; tests use `pickOption`
  from `@/testing/select`), no hand-styled buttons in features (`Button`, `IconButton`, `ListRow`).
- Repo in English; UI strings only via `t('...')`; every key in both `en.json` and `it.json` (tested).
- Imports (ESLint): features never import other features; shared folders never import
  `features` or `app`; no barrels; `@epd/domain` imports nothing from the app. Alias `@/` = `src/`.
- Data: every project change goes through `applyCommand` (undoable; issuing a quote is the
  exception). UI state (panels open, sizes) lives in the store's `ui`, outside undo, dirty flag
  and recovery. A project holds copies of the `items` and `cablePrices` it uses; BOM, checks and
  quotes read those, never the library ("Update from catalog" pulls changes in). Services come
  from `useEditorServices()`. TanStack Query only for local async reads.
- Routes: `/` start; `/settings/<general|company|catalog|presets|new-projects>` (project stays
  open; `/library/*` redirects); `/project/<plan|panel|quote|details>`; every route has an
  `ErrorBoundary`; editor, canvas and PDF code are lazy. `renderApp(path)` opens the demo project.
- Tests sit next to the code, each with a card comment `// protects=...; fails_when=...; no_claim=...`.
- File formats: `.epd` (`manifest.schemaVersion`, `doc.schemaVersion`), `.epc` and the library
  are versioned. Before the first release they stay at 1 and change in place (update
  `projectFile/fixtures/v1.json`, run `pnpm demo:epd`); after it, a bump, a tested migration and
  a frozen fixture of the previous version.
- Lengths: integer mm in the domain, meters at the edges. Money: integer cents. PDFs (jsPDF
  Helvetica) use WinAnsi only; PDF tests run in `@vitest-environment node`.
- jsdom has no canvas: canvas behavior is tested in the browser E2E via `window.__epd.store`,
  which uses in-memory files (`window.__epd.files`). Electron E2E stubs native dialogs in main and
  drives focus/full screen with `focusWindow` and emitted events (the OS may refuse them).
- macOS title bar (`hiddenInset`): the page is the drag region (`app-drag`); every control in it
  needs `app-no-drag`; `useTitleBarInset()` gives the traffic-light room.
- Save writes the bound path in place (no path: Save As); exports go through `useExportFile`.
- `useEditor(selector)` returns raw store fields; derive arrays with `useMemo` (render loop).
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
