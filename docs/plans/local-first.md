# Plan: backend-free, file-based app

Remove Supabase and accounts. The app stays a web app (static hosting, installable PWA,
offline after the first visit), desktop only. A project is a file the user opens and saves;
nothing about it lives on a server. A desktop wrapper (Tauri) stays possible later without
rewriting anything, because file access sits behind one interface.

Every step ends with typecheck, lint and tests green, and updates `CLAUDE.md` when it changes
commands, folders, key dependencies or conventions. The spec
(docs/specs/electrical-plan-designer.md) is updated in step 1 to match the decisions below.

## Decisions

- **No backend, no login.** Hosting is static (Netlify, GitHub Pages or Cloudflare Pages).
- **Desktop only.** The mobile view, the phone checklist and purchase ticks are removed; on a
  phone the user reads the exported PDFs.
- **A project is one `.epd` file** with everything it needs: drawing, floor plans, settings,
  company data, catalogs, box presets, issued quotes. Nothing outside the file changes how a
  project looks or prices.
- **Start screen:** new project, new project from template (any `.epd`: copies settings,
  company data, catalogs and box presets, not the drawing or the quotes), open file, resume
  draft, recent files (Chromium only).
- **Saving:** Save / Save as through the File System Access API on Chrome and Edge (Ctrl+S
  overwrites the opened file); elsewhere Save downloads the file. Chrome and Edge are the
  recommended browsers.
- **Draft:** the editor keeps writing the open project to IndexedDB (what autosave does today
  against Supabase), so a closed tab or a crash loses nothing. On start the app offers to
  resume it. Unsaved changes warn on `beforeunload` and show in the save status.
- **Settings and company data are per project**, seeded from defaults (or from the template).
- **Catalogs are per project.** The built-in catalog is always there; on top the user imports
  any number of catalogs (one per manufacturer or price list), which are copied into the
  project and stay there, so a project reopened years later prices as it did. Items can be
  edited one by one; a catalog can be removed or replaced with a newer one.
- **Quotes are numbered per project** (1, 2, 3…, printed with the project name) and carry a
  status: issued, approved, rejected, superseded. At most one approved quote per project.
  Issued quotes stay immutable except for status and note.

## The `.epd` file

A zip (new dependency: `fflate`, small and tree-shakable):

```
manifest.json      { format: "epd", schemaVersion, appVersion, savedAt }
project.json       ProjectFile without assets (below)
assets/<id>.<ext>  floor-plan PDFs and images, company logo
```

`ProjectFile` (zod schema in `packages/domain/src/projectFile.ts`):

- `meta`: name, client name, address, createdAt
- `company`: business name, VAT number, address, phone, email, `logoAssetId?`
- `settings`: `ProjectSettings` (unchanged)
- `quote`: `ProjectQuote` with the issued-quote changes below
- `catalogs`: `ProjectCatalog[]` (below)
- `priceOverrides`: built-in item and cable line prices (today's `profiles.price_overrides`,
  moved into the project)
- `boxPresets`: `BoxPreset[]` (today's `profiles.box_presets`)
- `doc`: the editor document; `backgroundSchema.storagePath` becomes `assetId`

Versioning: `schemaVersion` is an integer; `packages/domain/src/projectFile/migrations.ts`
holds one pure function per version step, and `loadProjectFile` runs them before validating.
A file from a newer app version is refused with a clear message. Old files must always open:
every migration gets a test with a frozen fixture of the previous version.

Saving is atomic where the platform allows it (the File System Access writable stream only
replaces the file on `close()`); a failed save leaves the previous file and the draft intact.

## Catalogs

```ts
interface ProjectCatalog {
  id: string;            // generated
  name: string;          // "Vimar 2026"
  importedAt: string;
  source?: string;       // original file name
  items: CatalogItem[];  // ownerId dropped; id = `${catalogId}:${code ?? generated}`
}
```

- `CatalogItem.ownerId` goes away; built-ins keep `builtin:<slug>` ids and the item lookup
  merges built-ins with every project catalog.
- **Import** from `.epc` (our JSON format, also exported from a project) or from CSV with a
  column-mapping dialog (code, name, price, unit, category, modules). A price list has no
  technical attributes: the dialog sets category and modules per row or for a selection, and
  items without them are "price only" (the checks say so where it matters). XLSX import is a
  follow-up, not part of this plan.
- **Replace** a catalog with a newer one: items are matched by `code`; the user sees a diff
  first (changed prices, new items, items used in the project but missing from the new list).
  Matched items keep their id, so the drawing keeps pointing at them; missing items that are
  in use stay with their old data and raise a check warning; per-item manual edits ask whether
  to keep or overwrite them.
- Manufacturer price lists are downloaded by the user; the app ships none.

## Quotes

`issuedQuoteSchema` gains `status` (`issued | approved | rejected | superseded`),
`statusChangedAt` and `note`. The number is `max(issued.number) + 1`;
`ProfileRepository.nextQuoteNumber` and the quote counter go away. Issuing a new quote marks
the previous pending ones superseded; approving one offers to mark the other pending ones
rejected. A later idea, not in this plan: compare the current BOM with the approved quote to
price change orders.

## Persistence interfaces

`src/lib/repositories/types.ts` shrinks to:

- `DraftRepository`: `get()`, `save(file)`, `clear()`, IndexedDB implementation plus an
  in-memory one for tests. Replaces `ProjectRepository.save` in autosave; no versions or
  conflicts (one tab, one draft; a second tab opening the app sees "draft in use" via
  `BroadcastChannel`, read-only).
- `FileAccess`: `open()`, `save(bytes)`, `saveAs(bytes, suggestedName)`, `recent()`, with a
  File System Access implementation, a download/`<input type=file>` fallback, and a fake
  for tests and E2E (`window.__epd`).

Removed: `AuthRepository`, `ProjectRepository` (list/get/create/delete), `ProfileRepository`,
`CatalogRepository`, `PurchaseRepository`, `FileRepository`, `Session`, `SaveError` codes
`version_conflict | network | auth_expired | forbidden`. Assets live in memory with the open
project (and in the draft); TanStack Query stays only where it still helps (lazy asset
decoding), the per-user query keys go.

## Steps

1. **Spec.** Update docs/specs/electrical-plan-designer.md: no accounts, file-based projects,
   desktop only, per-project catalogs and company data, quote status.
2. **Domain: file format.** `projectFile.ts` (schema, `loadProjectFile`, `serialize`),
   migrations scaffolding, catalog changes (no `ownerId`, catalog merge, replace-by-code diff
   as a pure function), quote status and numbering. Tests only; the app is untouched.
3. **Zip and assets.** `src/lib/projectFile/` reads and writes `.epd` with `fflate`;
   background and logo code read assets by id instead of storage path. Round-trip test with
   `tests/fixtures/demo-project.json` turned into `tests/fixtures/demo-project.epd` (a script
   replaces `build-seed.mjs`; a unit test fails when they drift).
4. **Open project state.** One open project per tab: the editor store loads a `ProjectFile`;
   autosave writes the draft through `DraftRepository`; save status shows saved / unsaved /
   draft only; `beforeunload` warning from `unsavedStore`.
5. **Start screen and routes.** `/` becomes the start screen (new, from template, open, resume
   draft, recent files); project routes move to `/project/{plan,panel,quote,settings,catalog,
   company}` and redirect to `/` when nothing is open. Save / Save as in the project frame,
   with Ctrl+S.
6. **Company and catalog inside the project.** ProfilePage becomes the project's company tab
   (logo embedded as an asset); CatalogPage edits the project catalogs; price overrides and
   box presets read from the project. CSV import with column mapping, `.epc` import/export,
   replace with diff.
7. **Quotes.** Per-project numbering, status, note, the approve/supersede rules; status shown
   in the quote list and on the PDF.
8. **Remove the backend and mobile.** Delete `supabase/`, `supabase.ts`, `memory.ts`,
   `memorySeed.ts`, `database.types.ts`, `features/auth`, `features/projects`,
   `features/mobile`, `features/profile` (moved in step 6), `lib/auth`, `RequireAuth`,
   `MobileShell`, `app/auth.ts`, `routes/mobile`, `bom` purchase marks and Checklist,
   `api/keys.ts` user scoping, `scripts/check-env.mjs`, `scripts/env-local.mjs`,
   `.env.local`/`.env.memory`, the `db:*`, `env:local`, `test:db`, `dev:mem` scripts and the
   `@supabase/supabase-js` dependency. `pnpm dev` no longer needs Docker; `pnpm verify` is
   typecheck, lint, test, test:e2e. Remove the now-unused i18n keys from both locales.
9. **E2E.** Specs start from the start screen and open `demo-project.epd` through the fake
   `FileAccess` (and once through the real `<input type=file>` fallback); save is checked by
   reading back the bytes the fake received. Delete `mobile.spec.ts`; the E2E no longer share
   a database, so the `db:reset` note goes.
10. **PWA and deploy.** `vite-plugin-pwa` (precache the app, pdf.js wasm included); a check
    that the app opens offline in Playwright. Rewrite docs/deploy.md for static hosting.
11. **Docs.** Final `CLAUDE.md` pass (commands, layout, conventions: no Supabase, file format
    versioning rule, "every schema change adds a migration and a frozen fixture").

## Risks and open points

- **Data loss** is the main risk without a server: draft in IndexedDB,
  `navigator.storage.persist()`, `beforeunload` warning and a visible unsaved state are all
  part of the first usable version, not polish.
- **Firefox and Safari** get the download-based save; acceptable since Chrome/Edge are
  recommended, but the start screen says so.
- **File size:** floor-plan PDFs and full manufacturer catalogs make files of a few MB;
  fine for zip and IndexedDB. If it grows, keep only used plus manually added items.
- **Existing cloud data:** no users yet, so no export from Supabase is planned. If that
  changes, add a one-off "download all my projects as `.epd`" before step 8.

## Progress notes

Done: steps 1–3 (commits `b9f9591`, `9346636`, `87be8d8`), then `c99e610` dropped all
compatibility code; step 4 (open project state); step 5 (start screen, routes, Save); step 6
(company and catalogs inside the project). Decisions and deferrals the remaining steps
must pick up:

- **No migrations before the first release** (no users yet): the doc and project file schemas
  stay at version 1 and change in place; update `projectFile/fixtures/v1.json` and run
  `pnpm demo:epd`. The migrations scaffolding stays for later (see `CLAUDE.md`).
- **Open project** (step 4): the store holds `data: ProjectFile` (undoable) and `assets`
  (outside undo; autosave and saves keep only referenced ones). Imported backgrounds get
  `newId()` asset ids and live in the store, nothing is uploaded. Until step 5 the editor is
  opened from a server record: `lib/projectFile/record.ts` (`openRecord`) downloads its
  backgrounds as assets with fresh ids and fills company, catalogs, price overrides and box
  presets with empty defaults (the UI still reads them from the profile, step 6).
- **Draft** (step 4): `DraftRepository` (`lib/repositories/drafts.ts`, IndexedDB `epd` v2,
  one record; replaces the per-project `unsavedStore`) holds the project, its assets,
  `savedToFile` and a transitional `recordId`; the loader resumes it when `recordId` matches
  the opened record, so the server record is no longer written (`ProjectRepository.save` is
  unused, as are the restore banner and the conflict dialog, both removed). Step 5 replaces
  `recordId` with the opened file and resumes the draft from the start screen; still to do
  there: "draft in use" across tabs (`BroadcastChannel`, read-only second tab).
- **Save status** (step 4): `saveStatusOf(state)` from three revisions: `saved` (the opened
  file has every change: `fileRevision`), `draft` (changes only in the draft:
  `draftRevision`), `unsaved` (not stored anywhere yet); `draftFailed` shows a retry.
  `beforeunload` warns only while `unsaved`. Without Save (step 5) an edited project stays
  `draft`; step 5 sets `fileRevision` on Save and may also warn on `draft`.
  `navigator.storage.persist()` is requested on the first draft write.
- **Start screen and Save** (step 5): `stores/editor/workspace.ts` holds the tab's one open
  project (editor store + autosave), opened from the start screen (`features/start`), a draft,
  or the `/projects/:id/*` bridge (`OpenRecord`, which also resumes that record's draft and asks
  before replacing another draft with changes not in a file). `FileAccess`
  (`lib/repositories/fileAccess.ts`): File System Access API with recent handles in IndexedDB
  (`epd` v3, `idb.ts`), file input + download elsewhere, in-memory fake (`createMemoryFileAccess`)
  in `renderApp`. The draft keeps the opened `file` (its handle too), so a resumed draft saves
  back to the same file. Save / Save as / Ctrl+S in the frame (`useSaveProject`); autosave writes
  the draft at open and after each save. Still open: the E2E app uses the real FS Access API
  (no E2E saves yet; step 9 exposes the fake through `window.__epd`), "draft in use" across tabs
  (`BroadcastChannel`), and the Supabase project list and its `New project` still exist next to
  the start screen until step 8. Catalog and company stay global pages until step 6, so the
  `/project/catalog` and `/project/company` routes come with it.
- **Mobile** (step 4): it reads the server record, which desktop edits no longer reach, so
  the E2E only checks purchase-mark sync now.
- **Company and catalogs** (step 6): `/project/company` (`features/company`, logo as an asset)
  and `/project/catalog` replace the global profile and catalog pages; `hooks/useCatalog` reads
  everything from the open project and pages edit it with undoable commands. Hand-made and
  duplicated items go to a catalog with the fixed id `own` ("My items"). Import: `.epc`
  (`catalog/epc.ts`) or CSV (`catalog/csv.ts`: delimiter detection, IT/EN price formats, header
  guessing; category and modules from a column or one default for all rows, no per-row or
  per-selection editing in the dialog: items are fixed one by one afterwards). Replace shows the
  diff and asks per hand-edited item. A catalog with items in use cannot be removed. Check 10:
  `item_dropped` and `price_only` (`catalog/attributes.ts`: modules for devices, covers, boxes
  and panel devices; inner Ø for conduits; rails × modules for enclosures). The Supabase
  profile, user catalog items and their repositories stay unused until step 8; server records
  open with empty company data and no imported catalogs.
- **Quotes** (step 7): the domain rules are in `packages/domain/src/issuedQuotes.ts`
  (`nextQuoteNumber`, `addIssuedQuote` supersedes pending quotes, `setQuoteStatus`,
  `setQuoteNote`); the app still uses `ProfileRepository.nextQuoteNumber`, appends snapshots
  without superseding and prints `formatQuoteNumber` as year + counter. Approving a second
  quote throws `already_approved`: the user first sets the approved one back to `issued`.
- **Templates**: `projectFileFromTemplate` copies VAT and material adjustment but not labor
  lines; the logo asset must be copied along by the caller.
- **Catalog item fields**: `CatalogItem` gained `editedAt` (set on manual edits, step 6) and
  `missing`; `ownerId` is gone and `isBuiltin()` checks the `builtin:` id prefix.
- **Local database**: rows written before `c99e610` (backgrounds with `storagePath`, quotes
  without `status`) no longer load; run `pnpm db:reset` before using the Supabase app.
