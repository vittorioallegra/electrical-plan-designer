# Spec: Electrical Plan Designer as a desktop app

Status: draft (2026-10-26). Supersedes the platform, persistence and per-project company/catalog
parts of docs/specs/electrical-plan-designer.md and docs/plans/local-first.md once implemented.

## Context

The app is a backend-free, desktop-only PWA. Mobile and the backend are gone, so the browser
now only costs us: Save downloads a new copy of the `.epd` every time (the browser renames it on
a clash), the draft lives in IndexedDB of one origin, and company data and catalogs live inside
each project, so every new project starts empty unless it is created from a template `.epd`.

The user (an electrician, solo or with a few colleagues, on macOS and Windows) wants one
installed app that opens and saves project files in place, and keeps company data, catalogs,
box presets and default settings in the app, set once and used by every project.

## Current State (verified 2026-10-26, commit d5821d8)

| Concern | Today | Where |
|---|---|---|
| Distribution | Static site, installable PWA (vite-plugin-pwa, service worker, offline) | `apps/web/vite.config.ts`, docs/deploy.md, `e2e/offline.spec.ts` |
| Open | `<input type=file>` | `src/lib/repositories/fileAccess.ts` (`FileAccess.open`) |
| Save | Download `<name>.epd`; never writes over a file | `FileAccess.download`, `useSaveProject` |
| Crash recovery | Draft of the open project in IndexedDB, resumed from the start screen | `src/lib/repositories/drafts.ts`, `idb.ts` |
| Multiple tabs | One tab holds the draft, others read-only or take over (BroadcastChannel) | `draftPresence.ts`, `stores/editor/workspace.ts`, `e2e/tabs.spec.ts` |
| Company data + logo | Per project (`ProjectFile.company`, logo as asset) | `packages/domain/src/projectFile.ts:41-47`, `features/company` |
| Catalogs | Built-in + per-project imported catalogs (`ProjectFile.catalogs`), "My items" (`own`), `priceOverrides` | `projectFile.ts:56-57`, `features/catalog`, `hooks/useCatalog` (18 importers) |
| Box presets | Per project (`ProjectFile.boxPresets`) | `projectFile.ts:58` |
| Settings, quote settings | Per project, seeded from defaults or a template | `projectFile.ts:54-55` |
| Template | "New project from template" copies everything but drawing and issued quotes | `projectFileFromTemplate`, `projectFile.ts:195`, `features/start` |
| Issued quotes | Snapshot of lines, settings, totals; no company snapshot | `packages/domain/src/schema.ts:302` |

No real users yet: schemas are at version 1 and change in place (see `CLAUDE.md`).

## Proposed Change

The app becomes an installed desktop application for macOS and Windows. The web/PWA build is
removed. The UI (React, editor, domain) stays; what changes is how files, recovery and the new
library are stored.

### 1. Desktop app

- Installers: macOS (`.dmg`, Apple Silicon and Intel) and Windows (installer `.exe` or `.msi`,
  x64). Unsigned for now; docs/deploy.md (renamed docs/release.md) explains how to open an
  unsigned app the first time on each OS. Signing must be addable later as a build step only.
- Fully offline. No network calls at runtime.
- One window, one open project (as today). Opening or creating another project replaces the
  current one, asking first when it has unsaved changes.
- Native menu with File (New, Open…, Open Recent, Save, Save As…, Close project), Edit
  (Undo, Redo, plus the standard text edit items), View, Help. Shortcuts follow the OS
  (Cmd on macOS, Ctrl on Windows). Existing in-app Save / Save as stay and do the same.
- The window title shows the project name and an unsaved marker (macOS: the document-edited
  dot; Windows: `*` prefix).

### 2. Files

- **Open** shows the native open dialog filtered to `.epd`. Errors (corrupt file, newer
  schema) keep today's messages.
- **Save (Cmd/Ctrl+S)** overwrites the file the project was opened from or last saved to,
  atomically (write to a temporary file in the same folder, then rename), so a crash during
  save never leaves a half-written `.epd`. A project never saved to a file behaves as Save As.
- **Save As** shows the native save dialog, default name `<project name>.epd`; later saves go to
  the new path.
- If the file on disk changed since it was opened or last saved (modified time or size
  differs), Save asks: overwrite, Save As, or cancel.
- If the file can no longer be written (deleted folder, read-only, disk full), Save shows the
  OS error and offers Save As; the project stays open with its changes.
- **Double-click on a `.epd`** in Finder/Explorer opens it in the app (file association with
  its own icon). If the app is already running, the file opens in the existing window, going
  through the same "unsaved changes" question.
- **Recent files**: the last 10 opened or saved paths, shown on the start screen and in
  File > Open Recent, newest first. An entry whose file no longer exists is shown as missing
  and can be removed; opening it explains the file was moved or deleted.
- **Closing** the window or quitting with unsaved changes asks Save / Don't save / Cancel.
- Exports (PDF, CSV) use the native save dialog instead of a browser download.

### 3. Crash recovery (replaces the IndexedDB draft)

- Autosave keeps writing the open project, as today, to a recovery copy in the app data folder
  (not next to the project file). It holds the project, its assets and the path of its file.
- The recovery copy is deleted after a successful Save and when the user chooses "Don't save".
- On start, if a recovery copy exists with changes not in its file, the start screen offers to
  restore it (as "resume draft" does today) or discard it. Restoring reopens it bound to its
  original path, still marked unsaved.
- The multi-tab machinery (BroadcastChannel presence, read-only second tab, take over) is
  removed: there is one window.

### 4. Library (app-level data)

The library lives in the app data folder (macOS `~/Library/Application Support/<app>/`,
Windows `%APPDATA%\<app>\`) and survives restarts and app updates. It holds:

| Library section | Edited where | In the `.epd`? |
|---|---|---|
| Company data + logo | Settings only | **No.** PDFs and quotes always print the current library company |
| Imported catalogs, "My items", price overrides | Settings only | Only a copy of the items the project uses (below) |
| Box presets | Settings only | No (placed boxes keep their own composition, as today) |
| Default project settings | Settings | Project gets a copy at creation, then edits its own |
| Default quote settings (VAT, material adjustment, labor lines) | Settings | Project gets a copy at creation, then edits its own |

- A **Settings** area (General, Company, Catalog, Box presets, New projects), reachable from the
  start screen, the title bar of an open project and the native menu, replaces the
  per-project company and catalog pages. It keeps today's catalog features (import `.epc` and
  CSV, replace with diff, edit items, "My items", remove) and company form, now writing to the
  library. Library edits are saved immediately; they are not part of a project's undo history.
- Removing a catalog from the library is allowed even if projects use its items: projects keep
  their copies.
- The built-in catalog still ships with the app and is shown as part of the library (read-only).
- **New project** copies default project and quote settings from the library. There is no
  "New project from template" any more.
- **Catalog items in a project**: when an item is placed (or set on a node, conduit, panel
  device…), the project stores a copy of it (code, description, category, attributes, unit
  price with the library price override applied). BOM, checks and quotes read the project's
  copies only, so a project reopened years later, or on another computer with a different
  library, prices the same. Built-in items are copied the same way. The item picker shows the
  library; items the project already uses show the project's copy.
- **Update catalog from library** (the only library→project update): shows the differences
  between the project's copies and the library (price changes, changed attributes, items no
  longer in the library) and applies the ones the user ticks. It is one undoable command.
  Items no longer in the library stay as they are and keep today's check 10 warning.
- There is no project→library action and no import of catalogs from a `.epd`.
- Prices typed in the quote materials table (e.g. built-in items or cables with no price)
  change only the project's copy, as one undoable command; the library is untouched.
  "Update catalog from library" then lists them as differences, showing both prices.
- **Library export/import**: "Export library" writes one `.epl` file (company, logo, catalogs,
  prices, presets, defaults); "Import library" validates a whole `.epl` and, after a
  confirmation, replaces the current library, keeping a backup copy of the old one in the app
  data folder. This is how the library moves to a new computer or a colleague.
- A `.epd` saved by the web build opens; its embedded company data, catalogs and price
  overrides are ignored, so its imported items show as missing and unpriced until they are in
  the library and the user runs "Update catalog from library".
- Issued quotes keep no company snapshot: reprinting an old quote uses the current company data.
  This is intended.
- A project opened on a machine with an empty library still opens, shows and prices with its
  own copies; it prints with an empty company block.

### 5. Project file changes (`.epd`)

Schemas stay at version 1 and change in place (pre-release rule): `ProjectFile` drops `company`,
`catalogs`, `priceOverrides` and `boxPresets`, and gains the used-item copies; the logo is no
longer a project asset. `projectFile/fixtures/v1.json` and `tests/fixtures/demo-project.epd`
(`pnpm demo:epd`) are updated. The library gets its own versioned format with the same rule
(version 1 until release, migrations after).

### 6. Removed

PWA (vite-plugin-pwa, service worker, manifest, icons for the web, `_headers`/`_redirects`),
static-host deploy docs, `offline.spec.ts`, IndexedDB draft and recent-handles stores, draft
presence and `tabs.spec.ts`, file input + download, `projectFileFromTemplate` and the template
start option, per-project company and catalog pages.

## Acceptance Criteria

1. `pnpm` builds an installable app for macOS (arm64 and x64) and Windows x64; installing and
   launching each shows the start screen with no network access.
2. Open → edit → Cmd/Ctrl+S writes the same path; reopening it shows the edit. No second file
   is created in the folder.
3. A save interrupted after the temp write but before the rename leaves the original file
   readable and unchanged.
4. Saving when the file was modified on disk by another program asks before overwriting.
5. Saving to a read-only or deleted location shows an error and offers Save As; no change is lost.
6. Double-clicking an `.epd` with the app closed launches it with that project open; with the
   app open and unsaved changes, it asks first.
7. Open Recent lists at most 10 paths, newest first; a moved file shows as missing.
8. Quitting with unsaved changes asks Save / Don't save / Cancel; Cancel keeps the app open.
9. Killing the app process after an edit and relaunching offers the recovery copy; restoring
   it shows the edit and saving writes to the original path.
10. Company data, catalogs, price overrides, box presets and default settings set in the
    library are present after a restart, in every new project, and on PDFs and quotes.
11. A saved `.epd` contains no company data, no logo, no imported catalogs, no presets; it
    contains a copy of every catalog item the project uses and nothing else from catalogs.
12. Changing a library price does not change the BOM or quote of an existing project until
    "Update catalog from library" is applied to that item; that action is undoable.
13. A project opened with an empty library shows the same BOM and quote totals as on the
    machine that saved it.
14. The start screen has no "from template" option; no PWA, IndexedDB draft or BroadcastChannel
    code remains (`grep` finds no `vite-plugin-pwa`, `indexedDB`, `BroadcastChannel` in `src/`).
15. `pnpm verify` passes; every new or changed test carries its
    `protects=...; fails_when=...; no_claim=...` card.
16. All UI strings added go through `t('...')` with keys in `en.json` and `it.json`.
17. Export library then Import library on a fresh install (empty `userData`) restores
    company, logo, catalogs, prices, presets and defaults; an invalid `.epl` is refused and the
    current library is unchanged.
18. A price typed in the quote materials table changes the project's totals and nothing in
    the library; undo restores the previous price.

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit (domain) | Used-item copy on place, catalog diff for update, BOM/quote from copies only, new project from library defaults, library schema load/validate | ~+12 |
| Unit (web) | File service (save in place, Save As, changed-on-disk, write error, recent list), recovery copy lifecycle, library store, Settings pages, start screen | ~+15, existing file/draft/presence tests rewritten or removed |
| E2E | Open → save in place, Save As, recovery after kill, library persists across restart and reaches a new project, update catalog from library, double-click open | ~+6, drawing specs run against the desktop build |

The E2E harness must drive the desktop app (or its renderer with a fake file service), keeping
an in-memory file fake for the drawing specs as today.

## Rules for the implementing agent

1. Acceptance criteria are the `protects / fails_when / no_claim` profile of each test: the
   observable it protects, the wrong result it rejects, and what green does not prove. Never
   "make the tests pass".
2. Real code and real tests land in the same change; a placeholder, a stub assertion or a test
   deferred to a follow-up is not done.
3. Any change to a test, validator, CI step, timeout, tolerance, threshold, snapshot or
   suppression pragma is reported on its own line in your summary with its justification,
   before any other result.
4. A reported command names the command and its observed result (exit status, counts, the
   failing line); a command you did not run is not reported, and stderr is never silenced in a
   command you cite.
5. Your report is a claim until the parent re-executes it: say what you verified, what you
   reused, and what you could not check.

## Rollback Plan

All work lands on a feature branch. The last web build is commit d5821d8; reverting the branch
restores the PWA. There are no users or deployed data to migrate back.

## Effort Estimate

Shell, packaging and file association ~1.5 days; file service and recovery ~1.5 days; library
storage and pages ~2 days; used-item copies, update from library and schema change ~2 days;
removals, E2E harness and docs ~1.5 days. About 8.5 days of human work.

## Out of Scope

- Code signing and notarization (later, as a build step).
- Auto-update of the app.
- Importing catalogs from a `.epd`; merging an imported library into the current one (import
  replaces it).
- Multiple windows or projects open at once.
- Linux.
- Migrating drafts or data from the web version (no users; `.epd` v1 files still open).
- Snapshotting company data in issued quotes.
