## Implementation plan
# Plan: Electrical Plan Designer

Spec: docs/specs/electrical-plan-designer.md

## Goal

Ship v1 of a web app where an electrician draws a residential electrical system on a
floor plan (panel → junction boxes → terminal boxes), designs the panel, routes
circuits through conduits, and gets a computed BOM, basic checks, PDF exports, a quote,
and a read-only phone view with a synced purchase checklist.

Success metric for v1 (measured at the dogfood checkpoint, step 19): drawing and
pricing one real floor of the author's house is not slower than paper, and the BOM
matches or beats the hand count (every difference explained).

## Architecture

```
src/domain/     pure TypeScript: model, defaults, geometry, lengths, routing, BOM,
                checks, conduit fill, quote math, built-in catalog. No React/Supabase.
src/data/       repository interfaces + two implementations: Supabase (real) and
                in-memory (unit/component tests, Docker-less dev). The only place
                that talks to Supabase.
src/state/      editor store (zustand + immer patches → undo/redo), autosave/save status.
src/features/   UI by feature: auth, projects, editor (canvas + tools), panel,
                circuits, catalog, bom, checks, export, quote, mobile, settings.
src/ui/         design tokens, shared components (Radix-based), icons, electrical
                SVG symbols, locale-aware number input/format.
src/i18n/       i18next setup, locales/en.json (base), locales/it.json.
src/config.ts   zod-validated env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_E2E).
supabase/       config.toml (pinned ports, email confirmation off locally),
                migrations/*.sql, seed.sql (dev user + demo project).
scripts/        check-env.mjs, env-local.mjs.
tests/e2e/      Playwright specs. tests/fixtures/ shared JSON fixtures (demo project).
```

Dependency rule: `features → state → domain`, `features/state → data → domain`,
`features → ui`. `domain` imports nothing from the app. Enforced with an ESLint
`no-restricted-imports` rule on `src/domain/**`.

### Stack (pinned at scaffold time)

pnpm, Vite, React 18, TypeScript (strict), react-router, Tailwind CSS, Radix UI
primitives (shadcn-style components copied into `src/ui`), lucide icons, zustand +
immer, zod, konva + react-konva, pdfjs-dist (worker via Vite `?url` import), jspdf,
i18next + react-i18next, @supabase/supabase-js, nanoid. Dev: Vitest + Testing Library +
jsdom, Playwright, ESLint (+ `eslint-plugin-i18next`), Prettier, Supabase CLI (pinned
dev dependency, run via `pnpm exec`).

### Screen map

```
/login, /signup
/projects                      project list (empty state: "New project")
/projects/:id/plan             editor (default view)
/projects/:id/panel            panel designer (shares top bar + bottom drawer)
/projects/:id/quote            quote settings, live totals, unpriced lines with inline price
/projects/:id/settings         project settings (heights, run elevation, slack, waste, fill)
/catalog                       account catalog + box presets
/profile                       business profile + logo
/m/projects, /m/projects/:id   mobile light view (checklist tab, read-only plan tab)

Editor layout (>= 1024 px):
+ top bar: project name | save status | undo/redo | Plan|Panel|Quote | export +
| left: floor tabs + tool palette | canvas | right: inspector (selection)    |
+ bottom drawer tabs: Circuits | BOM | Warnings (count badge) ---------------+
Progress strip: Plan -> Panel -> Conduits -> Boxes -> Circuits -> BOM; each stage
shows done / next and links to its tool.
```

Viewport: the mode (editor vs mobile view) is resolved once per session from the width
(< 768 px → mobile), with a manual switch in the menu; resizing never bounces routes.
768–1023 px gets the editor with a non-blocking "best on ≥ 1024 px" notice (see Open
questions).

### Key design decisions

- **Project document as one JSONB `doc`** (floors, nodes, segments, panel, circuits,
  extra runs) validated with zod on load, with `schemaVersion` and a `migrateDoc`
  pipeline (identity for v1, tested). A failed validation shows a recovery screen
  (download raw JSON, error path) via a typed `DocLoadError`, never a blank editor.
- **Built-in catalog lives in code** (`src/domain/catalog/builtin.ts`), with names as
  i18n keys and stable ids (`builtin:<slug>`). `catalog_items` holds only user items
  (spec Persistence updated accordingly). User items can duplicate a built-in.
- **Catalog references never dangle**: user items are always archived (soft delete),
  never removed (no cross-project scan needed); BOM and checks render an unknown
  `itemId` as an explicit "missing catalog item" line/warning, never drop it.
- **Prices**: account-level `price_overrides` (jsonb on `profiles`: itemId or cable line
  key → unit price + code). Lookup order: user item price → override → unpriced. This
  is how built-in items and `cable:<section>:<color>` lines get priced, and where the
  quote page's inline price edit writes. Cable colors are enum ids, not free text.
- **Undo/redo** via immer `produceWithPatches`; every document mutation (doc and project
  settings/quote edited in the editor) goes through one `applyCommand` entry point.
  File uploads are not undone; undo restores the previous background reference, so
  replaced background objects are kept until the project is deleted. Issued quotes
  are append-only and outside the undo stack.
- **Save status**: state machine `saved | dirty | saving | error | conflict`, shown in
  the top bar. Autosave debounced 1 s through an RPC
  `save_project(id, expected_version, doc, settings, quote)` (`SECURITY INVOKER`,
  plus an explicit `auth.uid() = owner_id` check) that returns the new version or
  raises `version_conflict`. Only one save is in flight at a time: edits during a save
  mark the doc dirty and the next save starts after the response with the returned
  version (no self-conflict). Typed `SaveError { code: 'version_conflict' | 'network' |
  'auth_expired' | 'forbidden' | 'invalid_doc' }`; bounded retry (3, exponential) for
  `network`, then retry on the `online` event and on the next edit; `auth_expired`
  re-login then retry; `beforeunload` guard while not saved. Every dirty doc is also
  written to IndexedDB (key: project id + base version); on load, a local copy newer
  than the server version offers "restore unsaved changes". A doc whose
  `schemaVersion` is newer than the app opens read-only and is never saved over. The conflict dialog offers
  "download my version (JSON)" before reload, so local work is never lost silently.
- **Routing graph**: undirected; nodes = plan nodes, edges = conduit segments weighted
  by computed length (risers included). Auto routing: one Dijkstra from the panel node
  per circuit, ties broken by segment id; the circuit occupies the union of the
  shortest-path-tree branches to its targets (always a tree, deterministic across
  renders and machines). Extra runs: same, from their `fromNodeId`. **Manual routing**
  stores `segmentIds` as a set: valid only when it is a tree (edges = nodes − 1) whose
  leaves are all the panel or targets and which reaches every target (a chain for one
  target; spec AC 6 is that case). Validation names the problem: dead-end segment,
  cycle, or unreached target.
- **Lengths in integer millimeters** inside the domain (or rounded to 1e-6 before any
  ceil) so 12.000000000000002 m never becomes 13 m.
- **Risers**: linking two riser points on adjacent floors (by `order`, same
  `riserGroupId`) creates the riser `ConduitSegment` automatically; unlinking deletes
  it; reordering floors rebuilds riser segments and invalidates manual routes that used
  removed ones. A riser point has no drop of its own: it sits at the elevation of the
  runs attached to it on its floor (`floor` → 0, `ceiling` → floor height; mixed run
  elevations at one riser point raise a warning). Riser length = |(elevation(upper) +
  h(upper end)) − (elevation(lower) + h(lower end))|. Both ends at floor level gives the
  spec's |Δelevation| (AC 10: 2.70 m); a ceiling run below into a floor run above gives
  ≈ 0 instead of double-counting a full floor height (spec updated).
- **Panels**: the doc schema holds `panels[]` (sub-panels are common in multi-floor
  houses); the v1 UI creates and edits exactly one. `upstreamDeviceId` cycles are
  rejected by the command and by a zod refine; upstream walks are depth-limited.
- **Geometry guards**: rejected by commands and zod: a segment from a node to itself,
  a non-riser segment between floors, an extra run from a node to itself. Paste gives
  copied riser points a new `riserGroupId` (unlinked). A custom height above the floor
  height is clamped and warned. Split-segment command: inserting a junction box into a
  segment rewrites manual routes that used it (both halves replace it).
- **Conductor occupancy** is derived, never stored: `occupancy(doc) → Map<segmentId, Conductor[]>`.
  BOM, conduit fill and the segment inspector all read it.
- **Structural deletes**: deleting a segment used by a manual route invalidates that
  route (the circuit shows a warning; it never silently falls back to auto); deleting
  a panel device used by circuits leaves them unprotected (check 3 fires). The cascade
  confirm lists every affected circuit/route.
- **Recalibration** after drawing: plan elements stay in meters; only the background
  scale changes.
- **Numbers**: inputs accept the locale decimal separator ("4,20"), display via `Intl`
  (lengths 2 decimals on screen, BOM whole meters, money `€ 1.234,56` in Italian).
  CSV number format follows the UI locale (comma decimals in Italian, `;` separator).
- **Wire colors** are always shown as swatch + role + color name (L brown), never
  color alone (color-blind safe).
- **Purchase checklist** stores the purchased quantity: `purchase_marks.purchased_qty
  numeric null` is the single source of truth (null = not bought; it replaces the
  spec's `purchased bool`). A line ticked with less than
  the current BOM quantity shows "bought 40 / need 52 m" and counts as not done. Marks
  whose line no longer exists are listed as "no longer in BOM".
- **Issued quotes are snapshots**: "Issue quote" freezes lines, unit prices, settings,
  totals, resolved item names (in the UI language at issue time), number and date into
  `projects.quote.issued[]`; PDF/CSV of an issued quote render from the snapshot, so
  later catalog price changes never alter it. Quote numbers come from a per-account
  counter on `profiles` incremented by an RPC.
- **Backgrounds in exports**: private backgrounds are fetched as blobs and shown via
  object URLs (never cross-origin signed URLs), so the Konva canvas is never tainted
  and `toDataURL` works for the PDF.
- **Canvas testability**: the store exposes a `window.__epd` handle only when
  `import.meta.env.DEV || VITE_E2E === 'true'`; a test asserts it is absent in a normal
  production build. Canvas tools also have keyboard/property-panel paths (numeric
  vertex/length entry, tab order, visible focus) with `data-testid`s, which is both
  the accessibility path and the E2E path.

## Steps

1. **Docs commit**: spec + this plan.
2. **Scaffold + dev environment**: Vite React TS with pnpm, strict tsconfig, ESLint (with
   the domain import rule), Prettier, Tailwind, Vitest, Playwright config, react-router
   skeleton per the screen map, i18n with `en.json`/`it.json` and a language switch,
   `.env.example`, `src/config.ts` (throws naming the missing var),
   `scripts/check-env.mjs` (Docker running, stack up, env vars present; prints a
   one-line fix, exits non-zero) wired into `predev`, `pretest:db`, `pretest:e2e`;
   `scripts/env-local.mjs` (writes `.env.local` from `supabase status -o env`). Scripts:
   `setup` (install → db:start → env:local → db:reset → playwright install chromium),
   `dev`, `dev:mem` (in-memory repositories, no Docker), `build`, `typecheck`, `lint`,
   `test`, `test:db`, `test:e2e`, `verify` (typecheck, lint, test, test:db, test:e2e),
   `db:start`, `db:stop`, `db:reset`, `db:types`. `CLAUDE.md` with setup, quiet and
   single-test commands, which steps need Docker, local-only seed credentials. Smoke
   test renders the app shell in both languages.
3. **UI foundations**: tokens (neutrals, one accent, semantic warning/error/success,
   separate canvas palette readable over a 40%-opacity background), compact editor
   density and large mobile density (tap targets ≥ 44 px), Radix-based Button, Dialog,
   Menu, Tabs, Table, Toast, locale-aware `NumberInput` with unit suffix, `formatNumber`
   / `formatMoney`, electrical symbol set (panel, junction box, socket, switch, ceiling
   point, riser; provision = dashed), editor layout shell with empty drawer/inspector.
   Tests: number parsing ("4,20", "4.20", "1.234,56" in it), formatting per locale.
4. **Domain model + defaults**: `types.ts`, `defaults.ts` (ProjectSettings,
   QuoteSettings defaults from the spec), `schema.ts` (zod for the doc), `migrateDoc`,
   `catalog/builtin.ts` (generic devices, blanking cover, plates 1–7 modules, boxes
   503/504/506, junction boxes, conduits 16/20/25/32 mm with inner Ø, H07V-K cables
   1.5–10 mm² with outer Ø and colors, MCB 1P+N 6–32 A curve C, RCD 2P 25/40 A 30 mA type
   A/AC, RCBO, isolator, SPD, enclosures 12/24/36 modules). Shared fixture
   `tests/fixtures/demo-project.json` (3 floors, panel, 3 circuits, risers). Tests:
   defaults match the spec, schema round-trips, built-in ids unique, fixture validates,
   upstream cycle and geometry guards rejected, newer `schemaVersion` → read-only.
5. **Domain geometry + lengths**: polyline length, calibration (meters per pixel from
   two points + real distance), node height resolution (mounting default → project
   settings → per-box override; ceiling = floor height), floor elevations, segment
   length for `floor`/`ceiling`/`direct`/riser, integer-mm arithmetic. Tests include spec
   AC 2, 4 (6.75 / 3.55), 10 (riser 2.70), 11 (settings isolation), riser with each
   floor/ceiling end combination, 3-floor riser chain, a length landing exactly on a
   whole meter.
6. **Domain routing**: undirected graph build, single-source Dijkstra with id
   tie-break, shortest-path-tree union per circuit, manual tree validation, extra
   conductor runs, `occupancy(doc)`, split-segment rewrite. Tests: AC 5, 6 (incl. a
   two-target manual tree), 7, equal-length alternatives give a stable result, manual
   route with a dead end / cycle / parallel duplicate rejected, disconnected targets
   reported, manual route invalidated by a deleted segment, split keeps routes valid.
7. **Domain BOM**: cable per (section, color) with termination slack, waste and
   ceil-to-1 m; conduit per item; boxes, contents (devices, covers, plates), panel
   devices + enclosure; provision boxes; stable line keys; unknown item ids → "missing
   item" line; purchase status per line from (required qty, purchased qty). Tests:
   AC 4 (13 m ×3, 12 m), 8, 9; adding/removing an element updates the totals; shortfall
   after the BOM grows; orphan marks.
8. **Domain checks + conduit fill**: checks 1–9 returning
   `{ id, severity: 'warning', elementRef, params }` (params feed i18n messages).
   Conduit fill: circumscribed bundle Ø from a packing-constant table for n = 1–20
   equal circles, area-based approximation above 20 and for mixed sections (largest
   outer Ø as d). Tests: one triggering and one clean fixture per check (AC 13).
9. **Domain quote math**: material lines from the BOM × unit price, adjustment %,
   labor lines, VAT, totals with cent rounding (integer cents internally); unpriced
   lines flagged; price lookup (user item → override → unpriced);
   `issueQuote(doc, catalog, overrides, settings, now)` snapshot. Tests: AC 15b fixture;
   an override prices a built-in line and a cable line; an issued snapshot is unchanged
   after a price edit.
10. **Supabase local schema** (first step that needs Docker; steps 2–9 do not):
    `supabase init` with pinned ports and local email confirmation off; migration with
    `profiles` (with `price_overrides`, `box_presets`, `quote_counter`), `projects`
    (`doc`, `settings`, `quote`, `version`), `catalog_items` (with `archived`),
    `purchase_marks` (`purchased_qty`, FK `ON DELETE CASCADE`), the `save_project` and
    `next_quote_number` RPCs,
    private buckets `backgrounds` and `logos` created in migrations with path-prefix
    policies (`<user_id>/<project_id>/...`), RLS on every table. `seed.sql`: dev user
    + demo project from the shared fixture + a few priced user catalog items. Generated
    types in `src/data/database.types.ts`. `docs/deploy.md`: link, `db push`, auth
    redirect URLs/SMTP, remote types. Integration tests (`test:db`, unique users per
    test): user A cannot read/write user B's rows or objects; user A calling
    `save_project` on B's project is forbidden; version conflict raises; purchase marks
    upsert; deleting a project cascades its marks.
11. **Auth, profile, project list**: Supabase email/password sign-up/login/logout,
    session-expiry redirect that keeps unsaved state, protected routes, profile form
    (business data + logo upload), project list (empty state, create/rename/delete
    with confirm; delete removes the project's storage prefix), new project copies
    defaults and creates floor 1. Component tests for forms; E2E: sign up → create
    project (AC 1).
12. **Editor shell + store**: load/validate doc (`DocLoadError` recovery screen),
    `applyCommand` with undo/redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z), save status machine
    with retry and conflict dialog ("download my version"), JSON export/import of the
    doc, floor list (add/rename/reorder/delete, height), project settings page. Tests:
    store undo/redo, autosave debounce, each `SaveError` code path (in-memory
    repository), edit during an in-flight save → two saves and no conflict, offline then
    reload → restore offer, `beforeunload` guard.
13. **Canvas base**: Konva stage in meters, pan/zoom, grid, snapping (node > vertex >
    wall end > grid; toggle with Alt), walls tool, background import (PDF page picker
    with thumbnails via pdfjs → PNG capped at 4096 px uploaded to `backgrounds`, images
    as-is, 20 MB limit; progress, encrypted/corrupt/oversize errors, upload retry),
    calibration tool, opacity/offset; empty-canvas prompt ("Import plan" / "Draw
    walls"). E2E: calibrate 4.20 m and measure (AC 2); walls-only plan (AC 3).
14. **Nodes + conduit segments**: place panel/junction/terminal/riser points with the
    symbol set; conduit tool (click source node, click to add vertices, finish on a
    target node; Esc cancels, Backspace removes the last vertex; ending on empty space
    creates a junction box); segment styling by run elevation; length labels hidden
    below a zoom threshold; selection incl. cycling through overlapping items (Tab),
    multi-select (shift/box), move, delete (cascade confirm), copy/paste of nodes with
    contents (Cmd/Ctrl+C/V, Alt-drag duplicate); riser linking across floors (riser
    shown on both floors); properties panel (label, mounting, custom height, status,
    conduit item, run elevation).
15. **Catalog + box contents**: catalog page (built-ins read-only, user items CRUD,
    duplicate, code, price, unit, modules, attributes per category, archive instead of
    delete when referenced); terminal box contents editor (devices, covers, plate;
    modules counter); provision toggle; per-account box presets (box + contents +
    plate), applied on placement, stored in `profiles.box_presets`.
16. **Minimal BOM drawer tab**: live BOM of boxes, devices, plates, conduit (cable lines
    appear once circuits exist). First visible payoff on a real floor.
17. **Panel designer**: front view with 1–N DIN rails (default 1), modules per rail
    from enclosure, device palette from catalog, drag into slots plus keyboard/inspector
    placement, upstream set by dropping onto an RCD group or via inspector dropdown,
    labels, overflow/overlap shown as hatched slots, total modules + suggested
    enclosure. Tests: slot placement, overlap/overflow (check 8), AC 12.
18. **Circuits UI**: circuit list per panel device; create/edit (type, section,
    conductors with swatch + role + name, targets picked on the plan in a "pick
    targets" mode with a cancel banner); auto/manual routing (manual: click segments
    with live validation); extra conductor runs with a "two-way switch" helper that
    pre-fills two travelers between two selected boxes; segment inspector shows
    occupancy; path highlight on the plan; "target unreachable" shown on the circuit.
19. **Checks panel + full BOM + dogfood checkpoint**: BOM grouped by category with
    totals; warnings grouped by type with click-to-select on plan/panel, calm badge,
    filter to hide connectivity warnings while drawing (presentation only). Live updates
    on every command. Checkpoint: draw one real floor of the author's house, compare
    the BOM with the hand count, record the time taken and every difference in this
    plan before continuing. E2E: first-project path following the progress strip.
20. **Exports + quote**: quote page (adjustment %, VAT, labor lines, live totals,
    unpriced lines with inline price edit), "Issue quote" snapshot; project PDF (cover,
    floors, panel, circuits, segments, BOM, warnings); quote PDF with business header
    (empty fields omitted; font with € and accented letters); CSV (`;`, UTF-8 BOM,
    locale decimals). Tests: CSV content snapshot from a fixture in en and it; quote
    totals; PDF generation smoke (page count, header text) including a floor with a
    private background; issued quote stable after price change. AC 15, 15b, 15c.
21. **Mobile light view**: < 768 px layout: project list, BOM checklist backed by
    `purchase_marks` (grouped by category, large quantities, "show remaining" filter,
    purchased quantity defaulting to the BOM quantity on tick, shortfall display,
    optimistic toggle with rollback + toast on failure), read-only plan with floor
    switcher and pan/zoom, high-contrast styling. E2E at 375 px: tick on mobile →
    visible on desktop after reload (AC 14); BOM grows after tick → line shows shortfall.
22. **i18n completeness + full run**: test that `it.json` has every key of `en.json`
    and no literal JSX strings (ESLint `i18next/no-literal-string` on `src/features`
    and `src/ui`); `pnpm verify` green; update `CLAUDE.md`.

Each step ends in one or more atomic commits that build and pass the tests touched.
If Docker is unavailable, steps 2–9 proceed first (they never need it) and the
editor steps can run on `dev:mem`; steps 10, 11 and every `test:db`/E2E wait for it.

## Tests summary

| Layer | Where | Approx. count |
|---|---|---|
| Unit (domain + ui formatting) | `src/domain/**/*.test.ts`, `src/ui/**/*.test.ts` | ~60 |
| Component | `src/features/**/*.test.tsx` | ~20 |
| Integration (Supabase local) | `src/data/**/*.db.test.ts` | ~10 |
| E2E | `tests/e2e/*.spec.ts` | ~9 |

Every test carries a one-line card comment: `protects=...; fails_when=...; no_claim=...`.

## Risks

- **Scope**: 22 steps, effectively 8 milestones. Mitigation: domain first, minimal BOM
  at step 16, dogfood checkpoint at step 19; stop and ask if a step balloons.
- **Docker required** for the local Supabase stack (Docker Desktop installed, daemon
  not running at planning time). Mitigation: steps 2–9 and `dev:mem` need no Docker;
  `check-env` fails fast with the fix.
- **Click cost on a real house** (80–150 boxes): multi-select, copy/paste and box
  presets in steps 14–15; measured at the dogfood checkpoint.
- **Canvas UX and E2E**: Konva is hard to drive from Playwright. Mitigation: property
  panels and the `__epd` test handle; E2E asserts on the document, not pixels.
- **PDF import**: large or vector-heavy PDFs render slowly. Mitigation: render one page
  at a capped resolution (max 4096 px side) and store the PNG, not the PDF.
- **Routing semantics**: real wiring through junction boxes can differ from shortest
  path. Mitigation: manual routing per circuit is always available.
- **Conduit fill accuracy**: packing table + approximation is a warning, not a
  certification; documented in the UI tooltip.
- **Concurrent edits** (two tabs): optimistic version check blocks silent overwrites;
  the conflict dialog offers a JSON download; merge is out of scope.
- **No CI yet** (no remote repository): `pnpm verify` is the gate; CI (migrations apply
  on an empty DB, `db:types` drift check, all suites) is added when a remote exists.

## Progress

Phase: implementation
Branch: feat/electrical-plan-designer
Spec: docs/specs/electrical-plan-designer.md
Approved: yes (2026-10-25)

### Steps
- [x] 1. Docs commit (spec + plan) — `docs: add electrical plan designer spec and plan`
- [x] 2. Scaffold, dev environment scripts, i18n, CLAUDE.md — `chore: scaffold app, dev environment scripts and i18n`
- [x] 3. UI foundations (tokens, components, symbols, number input) — `feat: add UI foundations (tokens, components, symbols, number input)`
- [x] 4. Domain model, defaults, schema, built-in catalog, fixture — `feat: add domain model, schema, defaults and built-in catalog`
- [x] 5. Domain geometry and lengths — `feat: add domain geometry and segment lengths`
- [x] 6. Domain routing and occupancy — `feat: add conduit routing, manual route validation and occupancy`
- [x] 7. Domain BOM — `feat: add BOM computation and purchase reconciliation`
- [x] 8. Domain checks and conduit fill — `feat: add basic checks and conduit fill`
- [x] 9. Domain quote math — `feat: add quote math, price lookup and issued snapshots`
- [x] 10. Supabase local schema, RLS, save RPC, storage, seed, deploy doc — `feat: add Supabase schema, RLS, save RPC, storage and seed`
- [x] 11. Auth, profile, project list — `feat: add repositories, auth, profile and project list`
- [x] 12. Editor shell, store, undo/redo, save status, floors, settings — `feat: add editor store, autosave, floors and project settings`
- [x] 13. Canvas base, walls, background import, calibration — `feat: add plan canvas, walls, background import and calibration`
- [x] 14. Nodes and conduit segments — `feat: add nodes, conduit tool, selection, move, copy/paste and risers`
- [x] 15. Catalog, box contents, presets — `feat: add catalog page, box contents editor and box presets`
- [x] 16. Minimal BOM drawer tab — `feat: add live BOM drawer tab`
- [x] 17. Panel designer — `feat: add panel designer with DIN rails, slots and upstream groups`
- [x] 18. Circuits UI and routing — `feat: add circuits tab, target picking, manual routes and extra runs`
- [ ] 19. Checks panel, full BOM, dogfood checkpoint
- [ ] 20. Exports and quote
- [ ] 21. Mobile light view and purchase checklist
- [ ] 22. i18n completeness, full test run, CLAUDE.md update

### Verification
- qa: pending
- review: pending

### Decisions
- Users: professional electrician, single account, projects per client (spec Phase 1).
- Cloud with accounts (Supabase); local CLI stack in development, cloud project later.
- Floor plan import = background + two-point calibration; no wall recognition.
- Cable model = conduits + conductors; circuits auto- or manually routed.
- Heights and quote settings are per project, never app-wide.
- Built-in catalog in code instead of seeded rows (spec Persistence updated).
- Manual routing = connected segment set covering panel and all targets.
- Purchase marks store purchased quantity; shortfall shown when the BOM grows.
- Issued quotes are frozen snapshots, numbered per account.
- User catalog items are archived, never deleted; prices for built-ins and cable lines
  via account price overrides.
- Auto routing = deterministic shortest-path tree; manual routing must be a tree.
- Doc schema holds `panels[]`; v1 UI edits one panel.
- Step order deviates from spec milestones: domain (4–9) before Supabase/auth (10–11)
  so Docker never blocks the critical path.
- Spec quality gate: Codex CLI not installed, outside review missing (not a pass).
- Check 9 added: active terminal box with no plate and no devices (user, 2026-10-25).
- Tablets 768–1023 px get the editor with a notice (user).
- Pack sizes (coils/rolls) deferred after v1 (user).
- Riser rule and persistence changes accepted and written into the spec (user).
- `check-env.mjs` is chained explicitly in `dev`, `test:db`, `test:e2e` instead of `pre*`
  scripts (pnpm does not run pre/post scripts reliably).
- Doc types are inferred from the zod schema (`types.ts` re-exports `z.infer`), so they
  cannot drift. Built-in defaults: box 506 = 7 modules, MCB 1P+N = 1 module (compact),
  RCD/RCBO = 2 modules; users duplicate items to change them.
- Money: catalog/override prices are integer cents; `QuoteSettings` amounts stay euros as in
  the spec and are converted with `toCents`. Material adjustment applies to the subtotal.
  Priced user cable items (section + color) price cable lines before overrides.
- `supabase/seed.sql` is generated by `scripts/build-seed.mjs` from the shared fixture (drift
  test in `scripts/build-seed.test.ts`). `save_project` raises `forbidden` (42501) for both
  "not found" and "not yours", since RLS hides other users' rows.
- Every command is checked with `docIntegrityIssues` after the recipe and rejected if it breaks
  the doc. Floor reorder/delete rebuild riser segments (`src/domain/risers.ts`); structural
  deletes keep dangling manual-route ids so the circuit shows as invalid.
- E2E runs its own Vite server on :5174 (`--mode e2e`), never reusing a dev server.
- Uncalibrated backgrounds show at 1 px = 1 cm. Konva's dblclick is not used (it fires for two
  quick clicks at different points); clicking a chain's last point again ends it.
- Canvas selection uses our own world-space hit test (`canvas/hitTest.ts`: node > segment >
  wall, Tab cycles), not Konva shape events. Ending a conduit on empty space (Enter or clicking
  the last bend again) creates a junction box there.
- `CatalogProvider` (mounted by `RequireAuth`) loads user catalog items and the profile (price
  list, box presets) once per session; built-in prices are set from the catalog page as account
  price overrides.

### Open questions
- None.

### Next
Add component tests for the circuits tab (create circuit, pick targets, manual route status,
two-way helper, segment occupancy) — step 18 shipped without them. Then step 19: checks panel
(Warnings tab, grouped, click-to-select, hide connectivity filter), full BOM, dogfood checkpoint.

## Review record

Run 2026-10-25, /autoplan (non-interactive, auto-decided). Outside voice (Codex): not
installed, so every phase is single-reviewer (Claude subagent + primary); consensus
columns are N/A, never CONFIRMED. Scope detector reported `uiRequired: false` (keyword
heuristic) but the product is UI-heavy, so the design phase was run anyway at the
requester's instruction. CEO, design and DX reviewers ran in parallel on the original
plan; eng ran last on the amended plan.

<!-- autoplan-accepted:ceo -->
- Repository interfaces with in-memory implementation; domain steps before Supabase; `dev:mem`.
- Minimal BOM tab at step 16; dogfood checkpoint at step 19 with time and hand-count comparison.
- Purchase marks store purchased quantity; shortfall and orphan marks shown; tests in steps 7 and 21.
- Issued quote snapshots; test that a price edit does not change an issued quote.
- Catalog soft delete; unknown item ids surface as "missing catalog item".
- Multi-select, copy/paste, box presets (steps 14–15).
- JSON export/import of the doc; conflict dialog offers "download my version".
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- Screen map and editor layout; progress strip; UI foundations step 3 (tokens, Radix components, symbols, densities).
- State coverage: empty states, import progress/errors, save status, conflict, unreachable target, mobile rollback toast, session expiry.
- Conduit tool, snapping, selection cycling, label density, riser display specified in steps 13–14.
- Locale-aware number input/format, CSV locale decimals, color-blind-safe wire labels.
- Viewport mode resolved once per session with manual switch; 768–1023 px editor with notice.
- Structural delete, recalibration, precision and undo-scope rules in Key design decisions.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->
- `.env.example`, `src/config.ts`, `env-local.mjs`, `check-env.mjs` in pre-scripts, `setup` and `verify` scripts.
- Seed: dev user + demo project from the shared fixture + priced user items; `docs/deploy.md`.
- Typed `SaveError`/`DocLoadError`, `migrateDoc`; `__epd` gated by DEV or `VITE_E2E` with a prod-absence test.
- CLAUDE.md lists quiet/single-test commands, Docker-dependent steps, local seed credentials. CI deferred until a remote exists.
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- Single in-flight save; IndexedDB copy of dirty doc with restore offer; online-event retry; `auth_expired` code; newer schema opens read-only.
- `save_project` SECURITY INVOKER + owner check; cross-user RPC test; marks FK cascade test.
- Price overrides for built-ins and cable lines; cable color enum ids.
- Deterministic single-source Dijkstra with id tie-break; manual route must be a tree; tests for ties, dead ends, cycles.
- Riser length from run elevation at each end; tests per combination and 3-floor chain; adjacent-floor linking.
- Integer-mm lengths; upstream-cycle rejection; geometry guards; split-segment command; `panels[]` in schema.
- Backgrounds via blob object URLs; PDF smoke test with a background. Issued quotes append-only, outside undo, per-account numbering.
<!-- /autoplan-accepted:eng -->

### Review scores

| Phase | Reviewer | Result |
|---|---|---|
| CEO | Claude subagent; Codex N/A | Right problem; 10 findings (5 high/medium accepted, 1 deferred: pack sizes; 1 to user: check 9) |
| Design | Claude subagent; Codex N/A | Initial scores IA 3, states 3, journey 4, specificity 5, design system 2, responsive/a11y 3, decisions 4; all findings integrated |
| DX | Claude subagent; Codex N/A | Initial TTHW 25–40 min, target ≤ 5 min (`pnpm setup && pnpm dev`, seeded login + demo project); deploy path 2 → docs/deploy.md |
| Eng | Claude subagent; Codex N/A | AC 4 and 15b math verified; 2 critical (save overlap, offline loss) + riser overcount + 5 high, all integrated |

Cross-phase themes: tablet 768–1023 px gap (CEO, design); conflict-dialog data loss
(CEO, design, DX, eng); purchase checklist going stale when the BOM changes (CEO,
design); Docker on the critical path (CEO, DX).

### Failure modes (after amendments)

| Scenario | Handled by |
|---|---|
| Edit during in-flight save → false conflict | single in-flight save (step 12 test) |
| Network drop then tab closed | IndexedDB copy + restore offer (step 12 test) |
| Ceiling run + riser double counts | riser rule (step 5 tests); spec update pending user |
| Tied paths change BOM between renders | id tie-break (step 6 test) |
| Ticked line after BOM grows | `purchased_qty` shortfall (steps 7, 21) |
| Issued quote changes after price edit | snapshot (steps 9, 20) |
| Tainted canvas on PDF export | blob object URLs (step 20 test) |
| Upstream cycle hangs checks | command + zod refine (step 4 test) |
| Old tab overwrites newer schema | read-only open (step 4 test) |

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rejected |
|---|---|---|---|---|---|
| 1 | all | Skip /office-hours offer and telemetry prompt (no user available) | Mechanical | P6 | asking |
| 2 | design | Run design phase despite `uiRequired: false` | Mechanical | P1 | skipping |
| 3 | CEO | Reorder: domain before Supabase, `dev:mem` | Taste | P1/P6 | spec milestone order |
| 4 | CEO | Purchased quantity instead of bool | Taste (spec deviation) | P1 | bool only |
| 5 | CEO | Issued quote snapshot | Mechanical | P1 | live quote only |
| 6 | CEO | Box presets + copy/paste + multi-select | Mechanical | P2 | one-by-one placement |
| 7 | CEO | Check 9 (empty active box) → open question | User call | spec scope | silently adding |
| 8 | CEO | Pack sizes deferred | Taste | P3 | v1 |
| 9 | design | Radix-based components, tokens, symbol set | Taste | P5 | Tailwind-only |
| 10 | design | 768–1023 px: editor with notice | Taste | P5 | read-only view |
| 11 | DX | CI deferred until a remote exists | Mechanical | P6 | CI now |
| 12 | eng | Riser rule changed from spec's height 0 | User challenge on spec math | P1 | spec rule |
| 13 | eng | `panels[]` in schema, one in UI | Taste | P1 | single panel |
| 14 | eng | Always archive user items | Mechanical | P5 | reference scan |
| 15 | spec | Spec fixed: manual routing wording, built-in catalog persistence | Mechanical | factual consistency | — |
