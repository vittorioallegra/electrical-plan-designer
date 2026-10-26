# Plan: desktop app

Turn the PWA into an Electron app for macOS and Windows: files opened and saved in place, a
recovery copy instead of the IndexedDB draft, an app-level library for company data, catalogs,
prices, presets and default settings, and projects that keep only copies of the items they use.
Spec: docs/specs/desktop-app.md.

Every step ends with typecheck, lint and the tests it touches green, and updates `CLAUDE.md`
when it changes commands, folders, key dependencies or conventions. Schemas stay at version 1
and change in place (pre-release rule).

## Steps

1. **Desktop shell.** Add `apps/desktop` (`@epd/desktop`: electron 45, electron-vite 6,
   electron-builder 26) and `packages/bridge` (`@epd/bridge`: types-only IPC contract and channel
   names). Main creates one `BrowserWindow` (contextIsolation, sandbox, no nodeIntegration,
   navigation and new windows blocked, a CSP), loads the Vite dev server in dev and the built
   `apps/web` renderer in production through a privileged custom scheme (`app://`,
   `protocol.handle` over the built files with an `index.html` fallback), not `file://`:
   `createBrowserRouter` paths and the PDF import's `fetch` of its worker/wasm do not work on
   `file://`. Main and preload are fully bundled (no runtime `node_modules` in the package, so
   pnpm's symlinked layout never reaches electron-builder); `electron` is allowed to run its
   install script in the pnpm build-script allowlist. Preload exposes an empty typed
   `window.epd`. Root scripts `pnpm desktop:dev`, `pnpm desktop:build` (unpacked app for the
   current OS). Playwright gets an `electron` project (`apps/desktop/e2e`, `_electron.launch` on
   the built app) with one smoke test: the start screen shows, a deep route reloads, no request
   leaves `app://`. ESLint import rules cover `apps/desktop` and `@epd/bridge` (types only, no
   imports from the app). The web dev server and all existing tests keep working.
2. **Files in place.** `FileAccess` becomes path-based: `open(): {path, name, bytes, stat}`,
   `save(path, bytes, expected stat)`, `saveAs(suggestedName, bytes)`, `exportFile(name, blob,
   filters)`. Main implements them with native dialogs and atomic writes (temp file in the same
   folder, fsync, rename; temp removed on failure; writes serialized per path; the new stat is
   returned and becomes the expected stat); `save` refuses with `changed_on_disk` when
   mtime/size differ and with the OS error code on write failure. Main writes only paths it
   handed out (open, Save As, recent, OS open) and validates every IPC argument and sender. Renderer: desktop implementation over `window.epd`, memory
   fake for jsdom and browser E2E. `useSaveProject` saves in place, Save As on a project with no
   path, asks on `changed_on_disk` (overwrite / Save As / cancel), offers Save As on write
   errors. Every `downloadBlob`/`downloadJson` caller (project PDF, quote PDF/CSV, doc JSON,
   `.epc` export) goes through `exportFile`; `lib/download.ts` keeps only `fileSafe`. Window
   title shows the project name and the unsaved marker (`setDocumentEdited` on macOS, `*` on
   Windows). Closing or quitting with unsaved changes asks Save / Don't save / Cancel through
   IPC (replaces `beforeunload`; main closes anyway if the renderer does not answer, the
   recovery copy keeping the changes). Tests: unit for the file service and save flow; Electron E2E
   open → edit → save writes the same path, changed-on-disk prompt, quit prompt.
3. **Recovery copy.** `RecoveryRepository` replaces `DraftRepository`: main stores
   `recovery/copy.json` (project plus meta: file path, stat, savedToFile, savedAt) and
   `recovery/assets/<id>` (written once per id, pruned to referenced ones) in `userData`, with
   the same atomic write as Save so a crash mid-autosave leaves the previous copy readable.
   Autosave writes it as it writes the draft today; a successful Save or "Don't save" clears it.
   Start screen: restore (bound to its original path, still unsaved) or discard. Remove
   `idb.ts`, `drafts.ts`, `draftPresence.ts`, `TabLock`/read-only/take-over code in
   `workspace.ts` and `StartPage`, `useDraftActions` take-over, `e2e/tabs.spec.ts`. Tests: unit
   for recovery lifecycle and start screen; Electron E2E kill the process after an edit,
   relaunch, restore, save to the original path.
4. **OS integration.** Native menu (File: New, Open…, Open Recent, Save, Save As…, Close
   project; Edit with Undo/Redo routed to the editor plus the standard roles; View; Help),
   accelerators `CmdOrCtrl`. Recent files (last 10 opened or saved paths, `recent.json` in
   `userData`, missing files flagged, removable) on the start screen and in Open Recent.
   Single instance lock; `.epd` passed on argv (Windows) or `open-file` (macOS), at launch or
   while running, opens through the same unsaved-changes question. electron-builder
   `fileAssociations` for `.epd` with its icon. Tests: unit for recent list; Electron E2E launch
   with a fixture path on argv opens it, a second launch with a path routes to the first.
5. **Library storage and pages.** `@epd/domain/library`: zod schema v1 `{schemaVersion, company,
   catalogs: ProjectCatalog[], priceOverrides, boxPresets, defaults: {settings, quote}}`,
   `defaultLibrary()`, load/validate with typed errors. Main stores it as files under
   `userData/library/` (`library.json`, `catalogs/<id>.json`, `logo.<ext>`), atomic writes,
   one file per change. A file that fails validation is never overwritten: it is renamed to
   `<name>.invalid-<timestamp>` and the app starts with defaults for that part and a visible
   notice. `LibraryRepository` (desktop + memory fake), `stores/library` (zustand,
   loaded before the first route renders, write-through, not undoable), `useLibrary`. New
   `features/library` with routes `/library/company`, `/library/catalog`, `/library/presets`,
   `/library/defaults`, reached from the start screen and the project frame; the company and
   catalog pages (import `.epc`/CSV, replace with diff, item edit, "My items", remove, export
   `.epc`) and the box preset editing move there, editing the library. Library routes keep the
   open project open and link back to it. The memory fake can be seeded in browser E2E
   (`window.__epd.library`) and in `renderApp`. Library export/import: "Export library" writes
   one `.epl` file (zip: `library.json`, `catalogs/<id>.json`, logo) through `exportFile`;
   "Import library" picks an `.epl`, validates it whole, and after a confirmation replaces the
   current library (the old one is first copied to `library.backup-<timestamp>/`). Projects
   still read their own data until step 6. Tests: domain schema; repository fake; pages (moved
   tests); `.epl` round trip and invalid file refused; Electron E2E library survives a restart.
6. **Projects use the library.** `ProjectFile` drops `company`, `catalogs`, `priceOverrides`,
   `boxPresets` and gains `items: CatalogItem[]` (copies, unit price with the library override
   applied) and `cablePrices` keyed by the BOM cable key `cable:<section>:<color>` (resolved
   with today's `lookupPrice` rules: matching library cable item, else override of the built-in
   cable of that section), derived from the circuits' cable specs, not from the BOM. Both
   default to empty so a v1 file in the previous shape still opens. Domain:
   `copyUsedItems(project, libraryLookup)` adds copies for every referenced item id (one
   `referencedItemIds(doc)` shared with check 10: boxes, contents, conduits, panel devices,
   enclosures) not yet in `items`, adds missing cable prices, and drops copies no longer
   referenced; called by `applyCommand` inside the same recipe (so undo/redo restore copies),
   a no-op when the referenced set is unchanged. BOM, checks, quote and panel helpers get a
   lookup where the project copy wins over the built-in (an app update never reprices an old
   project); built-ins are a fallback only for ids not yet copied. Check 10 `missing_item`
   reads an optional "in library" predicate, so a copy gone from the library warns while BOM
   and totals stay library-independent. `newProjectFile(input,
   library.defaults)`; `projectFileFromTemplate` and the template start option go. `useCatalog`
   splits into the picker view (library + built-ins, project copy wins for used ids) and the
   pricing view (project copies only). PDFs and quotes read company and logo from the library;
   the logo stops being a project asset. The quote materials price cell stays editable and
   writes only the project copy (item `unitPrice` or `cablePrices` entry, undoable); the library
   is never touched from a project. Box contents stop writing presets into the project. A
   `.epd` saved by the web build opens with empty `items`/`cablePrices`; its embedded catalogs
   and price overrides are ignored (no rebuild). Update `projectFile/fixtures/v1.json`, `scripts/build-demo-epd.mjs`
   and `pnpm demo:epd`. Tests: domain copy/sync, BOM and quote from copies with an empty library,
   new project from defaults, saved `.epd` has no company/catalogs/presets, an app-built-in
   change does not reprice a project holding a copy; existing web tests and E2E adapted (specs
   that print company data seed the library fake).
7. **Update catalog from library.** Domain `catalogUpdateDiff(project, libraryLookup)`:
   per used item price change, attribute changes, missing from library; `applyCatalogUpdate`
   for the ticked items. Dialog in the project (reusing the replace-diff UI), one undoable
   command; missing items stay with today's check 10 warning. Tests: domain diff/apply; dialog;
   Electron E2E change a library price, project unchanged until update, undo restores.
8. **Remove the web build, package, CI, docs.** Remove vite-plugin-pwa, manifest and web icons,
   `_headers`/`_redirects`, `e2e/offline.spec.ts` and the `offline` Playwright project.
   electron-builder config: `.dmg` (arm64, x64), NSIS (x64), app and file icons, no Developer
   ID (macOS builds are ad-hoc signed, otherwise arm64 refuses to launch as "damaged").
   `.github/workflows/desktop.yml` (manual + tag): typecheck, lint, unit tests and browser E2E
   on ubuntu; build plus the Electron E2E project on macos-latest and windows-latest (no
   Electron on Linux); upload installers as artifacts. docs/deploy.md → docs/release.md
   (build, CI artifacts, opening unsigned apps: macOS Privacy & Security "Open Anyway",
   Windows SmartScreen "Run anyway"). Update docs/specs/electrical-plan-designer.md (platform, persistence, catalog
   sections point to the desktop spec), `CLAUDE.md` (commands, folders, conventions).
   `pnpm verify` runs the browser and Electron E2E projects.

## Risks

- **Step 6 is the largest** (schema, 18 `useCatalog` consumers, PDFs, fixtures). Keep it one
  step but split into commits: domain first (copies + lookup), then web wiring, then fixtures.
- **Price edits in the quote** now change only the project copy, so "Update catalog from
  library" (step 7) lists them as differences; the dialog must show the project price next to
  the library price so the user does not overwrite them by accident.
- **Electron E2E on macOS CI** needs a built app per run (slower); keep the Electron specs few
  and the drawing specs in the browser project.
- **No GitHub remote yet**: the workflow is committed but runs only once the repo is pushed.
- **Unsigned apps**: Gatekeeper and SmartScreen warnings; documented in docs/release.md.
- **Atomic rename on Windows** fails if another program holds the file open; surfaced as a
  write error with Save As.

## Review notes (autoplan, 2026-10-26)

CEO, design and eng reviews run in-host (Codex disabled; DX skipped: no developer-facing
product, contributor DX folded into eng). Applied to the steps: `app://` scheme instead of
`file://` (router and PDF worker/wasm), bundled main/preload and pnpm build-script allowlist
(1); fsync, serialized writes, path allowlist, close fallback (2); atomic recovery writes
(3); invalid library files kept aside, library routes keep the project, seedable fake (5);
cable price keys, copy-wins lookup, shared `referencedItemIds`, check 10 via an "in library"
predicate, tolerant v1 load (6); ad-hoc macOS signing, no Electron E2E on ubuntu (8).
Recommended, not applied: a first-run nudge to fill in company data (empty library prints
an empty company block); a count of available library updates in the project frame (7).

## Architecture

### Choices

| Concern | Choice | Rejected and why |
|---|---|---|
| Desktop shell | Electron 45 | Tauri 2: needs Rust, system WebKit on macOS differs from the Chromium the tests run on, no macOS WebDriver for E2E |
| Build | electron-vite 6 (main, preload, renderer on Vite 8) + electron-builder 26 (dmg, NSIS, file associations) | Electron Forge 8: second build pipeline next to Vite, weaker file-association config |
| Library storage | JSON files in `userData/library/`, one per catalog, atomic writes, zod schema v1 | SQLite (native module to rebuild per OS for data that fits in memory); electron-store (rewrites one big file per change) |
| Recovery | Files in `userData/recovery/`, assets written once by id | Zipping the whole `.epd` on every autosave (MBs of PDFs rewritten each time) |
| E2E | Browser project for drawing specs with in-memory fakes; few Electron specs for files, recovery, library, OS open | All specs in Electron (slower, rewrite) |
| Windows build | GitHub Actions on windows-latest (+ macos-latest) | Building NSIS from the Mac (never launched before release) |

### Processes and data flow

- **Main** (`apps/desktop/src/main`): window, menu, single instance and open-file events,
  dialogs, file IO (open, atomic save with stat check, save as, export), recovery files,
  library files, recent list. No React, no domain logic beyond schema validation of what it
  reads (`@epd/domain/library`).
- **Preload** (`apps/desktop/src/preload`): `contextBridge.exposeInMainWorld('epd', bridge)`;
  every call is `ipcRenderer.invoke` on a channel from `@epd/bridge`; events (open file,
  close requested, menu commands) via `on(...)` returning an unsubscribe.
- **Renderer** (`apps/web`): unchanged React app. `app/main.tsx` builds services from
  `window.epd` when present, else from the memory fakes (browser E2E, dev in a browser).
  Services are `fileAccess`, `recovery`, `library`, `recent`, `workspace`, read with
  `useEditorServices()`. The open project stays in the editor store (`applyCommand`, undo,
  autosave to recovery); the library lives in `stores/library`, outside undo.
- **Domain** (`packages/domain`): `library.ts` (schema, defaults), `projectFile.ts` (no
  company/catalogs/prices/presets, `items`, `cablePrices`), `catalog/copies.ts` (copy used
  items, update diff/apply). Pure, tested in node.

### Folders

```
apps/desktop/                 @epd/desktop
  electron.vite.config.ts     main + preload; renderer root = ../web
  electron-builder.yml        dmg, nsis, fileAssociations, icons
  src/main/                   index.ts, window.ts, menu.ts, files.ts, recovery.ts,
                              library.ts, recent.ts, openRequests.ts (+ *.test.ts, node)
  src/preload/index.ts
  e2e/                        Electron Playwright specs + helpers (launch with temp userData)
  build/                      icons (app, .epd document)
packages/bridge/              @epd/bridge: bridge.ts (EpdBridge interface, channel names)
apps/web/src/
  lib/repositories/           types.ts, fileAccess.ts, recovery.ts, library.ts, recent.ts
                              (desktop impl over window.epd + memory fakes)
  stores/library/             library store
  features/library/           company, catalog, presets, defaults pages
```

Tests stay next to the code with the card comment; main-process tests run in a new Vitest
project `desktop` (node). Each Electron E2E launches with a fresh temp `userData` and temp
project folder.

### i18n

New UI strings (library pages, dialogs, menu labels, recovery, update diff) via `t('...')`
in `en.json` and `it.json`. The native menu labels come from the same locale files (main
receives the resolved strings from the renderer at startup and on language change).

## Progress

Phase: done
Branch: feat/desktop-app
Base: main
Spec: docs/specs/desktop-app.md
Architecture: agreed
Approved: yes (2026-10-26)

### Steps
- [x] 1. Desktop shell — `feat: add the Electron desktop shell`
- [x] 2. Files in place — `feat: open and save project files in place`
- [x] 3. Recovery copy — `feat: keep a recovery copy of the open project in the app data folder`
- [x] 4. OS integration — `feat: add the native menu, recent files and opening files from the OS`
- [x] 5. Library storage and pages — `feat: add the library pages with export and import as an .epl file`
- [x] 6. Projects use the library — `feat: make projects use the library through copies of the items they use`
- [x] 7. Update catalog from library — `feat: add the update of a project's catalog from the library`
- [x] 8. Remove the web build, package, CI, docs — `chore: remove the web build and add the desktop installers, CI and release docs`

### Verification
- qa: done
  - a file that is not a project stayed in the recent list after the open error — `fix: drop a file that fails to open from the recent list`
  - a plan image dropped from the recovery copy while unreferenced (then restored by undo) was never sent again, so a recovered project lost it — `fix: resend a recovery asset that main dropped and the project uses again`
- review: done
  - Ctrl/Cmd+S could reach both the page shortcut and the native menu's Save, each with its own in-flight guard: two writes, the second with a stale stat, showed a false "changed on disk" question — `fix: run one save when the shortcut and the menu Save arrive together`
  - the recovery copy wrote meta.json before project.json, so a crash between them paired the new asset list with the previous project — `fix: keep the recovery copy consistent when a write fails midway`
  - the .epl import replaced the library file by file in main (a disk error midway left a mixed library on disk while the store kept the old one) and replaceAll was not on the write queue, so edits could interleave — `fix: replace the library all-or-nothing and queue the replace with other edits`
  - once the renderer acknowledged a close request, a renderer crash or reload left the window unclosable — `fix: close the window when the renderer is lost after acknowledging a close request`

### Decisions
- Desktop only: the web/PWA build is removed (no users yet).
- macOS (arm64 + x64) and Windows x64; installers unsigned for now.
- One window, one project; explicit Save overwrites the opened file; autosave writes a
  recovery copy in the app data folder.
- MVP extras: `.epd` file association (double-click), recent files, library export/import as
  one `.epl` file (added after the reviews: the library is the only home of company data and
  catalogs, so it must move between computers). No auto-update.
- App library holds company + logo, catalogs, "My items", price overrides, box presets,
  default project and quote settings; it is the only place where company, catalogs, prices
  and presets are edited.
- The `.epd` holds no company data, catalogs or presets: only settings (copied from library
  defaults, then edited per project) and copies of the catalog items it uses.
- "Update catalog from library" is the only library→project sync (diff, pick, undoable); no
  project→library action, no catalog import from `.epd`.
- "New project from template" is removed. No migration of web drafts.
- Electron 45 + electron-vite 6 + electron-builder 26 (over Tauri: no Rust, same Chromium as
  the tests, Playwright drives Electron).
- Library as JSON files in `userData/library/` (over SQLite and electron-store).
- E2E mixed: drawing specs in the browser with fakes, few specs on the real Electron app.
- Windows and macOS installers built and smoke-tested on GitHub Actions.
- Prices typed in the quote materials table change only the project copy, never the library.
- `.epd` files from the web build open, but their embedded catalogs and price overrides are
  ignored (no rebuild of the copies).
- Review recommendations not taken for now: first-run company nudge, update count badge.
- A price typed in the quote for an item with no project copy and no library entry (only in
  `.epd` files from the web build) is ignored without a message; accepted as is (rare, no old
  files in circulation).

### Open questions

### Next
Ready to publish.
