# Spec: Electrical Plan Designer (epic)

Status: draft (2026-10-25); revised 2026-10-26 for the backend-free, file-based app,
implemented the same day (open points: docs/plans/local-first.md, "Still open");
packaged as a desktop app afterwards: platform, saving, recovery, company data and catalogs
are now specified in docs/specs/desktop-app.md, which supersedes the sections below that point to it

## Context

An electrician designs residential electrical systems on paper today: the floor plan,
the conduit runs, the boxes, the panel, and a hand count of cable meters and devices.
Hand counts drift (one box or one device missed), and the paper drawing is the only
record of where cables actually run inside the walls.

This app lets the electrician draw the whole system on top of a floor plan (drawn
from scratch or imported from a PDF/image), from the panel through junction boxes to
terminal boxes, and get two things out of it:

1. An exact, exportable record of how conduits and conductors run through the house.
2. A bill of materials (BOM): cable meters per cross-section and color, conduit meters
   per diameter, boxes, devices, plates, panel devices, priced for a quote.

First real use: the author's own house. Primary user: a professional electrician
working on a desktop computer, one `.epd` file per client project. There are no
accounts and no server: the app is a desktop app (Electron) and every project lives in a
file the user opens and saves.

## Current State

Milestones 1–8 below were built on a Supabase backend (accounts, Postgres, Storage) with
a mobile light view. Milestone 9 replaces that backend with `.epd` files, removes
accounts and the mobile view, and moves catalogs, price list, box presets and company
data into the project. No users or cloud data exist yet, so nothing is migrated.
Reference workflow being replaced: paper drawing + manual counting.

## Goals and success criteria

- G1: Drawing the author's house (multiple floors, panel, junction boxes, terminal
  boxes, circuits) is possible end to end in the app without paper.
- G2: The BOM is computed from the drawing, never typed by hand: adding or removing a
  box, device or conduit segment updates the BOM immediately.
- G3: A project is a self-contained `.epd` file: reopened years later on another computer
  it looks and prices exactly as when it was saved, and no work is lost if the tab closes
  before saving.
- G4: The electrician exports a PDF of the project detail and a quote (PDF + CSV).

## Platform and stack

| Concern | Choice |
|---|---|
| App | Desktop app (Electron, macOS and Windows) around a React + TypeScript renderer built with Vite; platform and packaging: docs/specs/desktop-app.md |
| Plan canvas | Konva (`react-konva`), world units in meters |
| PDF background import | `pdfjs-dist` renders a chosen page to an image |
| Backend | None, no network at runtime |
| Project files | `.epd` = zip (`fflate`) of a manifest, the project JSON and its assets; opened and saved in place through native dialogs (docs/specs/desktop-app.md) |
| Recovery | Copy of the open project in the app data folder, written by autosave |
| PDF export | `jspdf` (+ canvas snapshots of the plan and panel views) |
| i18n | `i18next` + `react-i18next`; English base, Italian translation |
| Tests | Vitest (unit, domain logic), Playwright (E2E) |

Desktop only. The editor targets windows ≥ 1024 px wide; narrower windows get the same
editor with a non-blocking "best on a larger screen" notice. There is no phone view: on a
phone the user reads the exported PDFs. Domain logic (geometry,
lengths, routing, BOM, checks, project file schema and migrations) lives in a pure
TypeScript module with no React or storage imports so it is unit-testable. File access,
recovery and the library sit behind interfaces implemented by the desktop main process (and
in-memory fakes in browser tests).

## Domain model

All lengths in meters, cross-sections in mm², diameters in mm.

### Project and settings (settings are per project, never app-wide)

```ts
interface ProjectSettings {
  mountingHeights: {          // height of the box center from finished floor
    socket: number;           // default 0.30
    switch: number;           // default 1.10
    junctionBox: number;      // default 0.25 from finished floor
    panel: number;            // default 1.50
  };
  defaultFloorHeight: number; // floor-to-floor, default 2.70
  defaultRunElevation: 'floor' | 'ceiling'; // where conduit runs horizontally, default 'floor'
  terminationSlack: number;   // extra conductor per segment end, default 0.20
  wastePercent: number;       // applied to cable and conduit totals, default 10
  conduitFillFactor: number;  // conduit inner Ø ≥ factor × bundle Ø, default 1.3
}
```

A new project copies these defaults; editing them affects only that project.

### Floors

`Floor { id, name, order, height (default from settings), background?, walls[] }`.
Floor elevation = sum of heights of the floors below it.
`background { assetId, kind: 'pdf' | 'image', page?, calibration { p1, p2, realDistance }, offset, rotation, opacity }`.
Calibration: the user clicks two points on the background and types the real distance;
this sets meters-per-pixel. `Wall { id, a, b, thickness }` for plans drawn from scratch.

### Nodes (things placed on the plan)

```ts
type NodeKind = 'panel' | 'junction_box' | 'terminal_box' | 'riser_point';
type Mounting = 'socket' | 'switch' | 'ceiling' | 'custom';
interface PlanNode {
  id; floorId; kind: NodeKind; position: { x; y }; label;
  mounting?: Mounting;        // terminal boxes; 'ceiling' = floor height
  customHeight?: number;      // overrides the mounting default for this box only
  boxItemId?: string;         // catalog box/junction box type (e.g. 503, 3 modules)
  contents?: { itemId: string; qty: number }[]; // devices, blanking covers, plate
  status: 'active' | 'provision';  // provision = conduit only, may have no wire/devices
  riserGroupId?: string;      // links riser points across floors
}
```

A terminal box may have no devices (provision) or only a plate with blanking covers.

### Conduit segments (tracce)

```ts
interface ConduitSegment {
  id; fromNodeId; toNodeId;
  vertices: { x; y }[];       // intermediate points; empty for risers
  conduitItemId: string;      // catalog conduit, carries outer/inner diameter
  runElevation: 'floor' | 'ceiling' | 'direct'; // default from settings
}
```

Segment length:
- Same floor: plan polyline length + vertical drop at each end.
  `floor`: drop = node height; `ceiling`: drop = floor height − node height;
  `direct` (box to box in the wall): plan length + |h(from) − h(to)|.
- Riser (endpoints are riser points on different floors, same `riserGroupId`):
  each riser end sits at the elevation of the runs attached to it on its floor
  (`floor` → 0, `ceiling` → floor height; mixed run elevations at one riser point raise
  a warning). Length = |(elevation(upper floor) + h(upper end)) − (elevation(lower floor) + h(lower end))|.
  Both ends at floor level gives the floor-to-floor height; a ceiling run below into a
  floor run above gives ≈ 0, so a floor height is never counted twice.

### Panel

```ts
// The document holds `panels: Panel[]`; the v1 UI edits one panel.
interface Panel {
  nodeId; enclosureItemId?; dinRails: number; // default 1
  modulesPerRail: number;     // from enclosure, default 12
  devices: PanelDevice[];
}
interface PanelDevice {
  id; itemId;                 // MCB, RCD, RCBO, isolator, SPD...
  rail: number; slot: number; // module position; width from catalog `modules`
  upstreamDeviceId?: string;  // e.g. MCB under an RCD
  label;
}
```

The panel view shows a front view of the DIN rails; total modules and a suggested
enclosure size are displayed.

### Circuits and conductors

```ts
interface Circuit {
  id; name; type: 'lighting' | 'sockets' | 'dedicated' | 'other';
  panelDeviceId: string;      // protecting device
  crossSection: number;       // 1.5, 2.5, 4, 6, 10...
  conductors: { role: 'L' | 'N' | 'PE'; color: string }[]; // default L brown, N blue, PE yellow-green
  targetNodeIds: string[];
  routing: { mode: 'auto' } | { mode: 'manual'; segmentIds: string[] };
}
interface ExtraConductorRun {     // travelers, switched returns, push-button wires
  id; circuitId?; fromNodeId; toNodeId;
  conductors: { role: 'traveler' | 'return' | 'other'; crossSection; color }[];
  routing: { mode: 'auto' } | { mode: 'manual'; segmentIds: string[] };
}
```

Auto routing: shortest path (by segment length) through the conduit graph from the
panel node to each target; the circuit occupies the union of those paths, so a shared
trunk is counted once. Manual routing: the user clicks the segments; the app rejects a
selection that is not one connected set containing the panel node and every target
(a chain for one target, a tree for several).

### Catalog

`CatalogItem { id, category, name, code?, unitPrice?, unit: 'pcs' | 'm', modules?, attributes }`.
Categories: `device` (socket, Schuko, switch, two-way, intermediate, push button...),
`blanking_cover`, `plate`, `box`, `junction_box`, `conduit` (outer/inner Ø), `cable`
(cross-section, outer Ø, color), `panel_device` (type, poles, rating, curve, RCD
sensitivity/type), `enclosure`.

Catalogs live in the app library, and a project keeps copies of the items it uses
(docs/specs/desktop-app.md). The built-in catalog (generic, read-only items with stable
`builtin:<slug>` ids) is always available; on top of it the project holds any number of
imported catalogs, one per manufacturer or price list:

```ts
interface ProjectCatalog {
  id: string;            // generated
  name: string;          // "Vimar 2026"
  importedAt: string;
  source?: string;       // original file name
  items: CatalogItem[];  // id = `${catalogId}:${code ?? generated}`
}
```

Item lookup merges the built-ins with every project catalog. Imported catalogs are
copied into the project and stay there, so a project reopened later prices as it did.

- Import from `.epc` (the app's JSON catalog format, also exported from a project) or
  from CSV through a column-mapping dialog (code, name, price, unit, category, modules).
  A price list has no technical attributes: the dialog sets category and modules per row
  or for a selection; items without them are "price only", and the checks say so where
  it matters.
- Items can be edited one by one; a catalog can be removed or replaced with a newer one.
- Replace matches items by `code` and shows a diff first: changed prices, new items, and
  items used in the project but missing from the new list. Matched items keep their id,
  so the drawing keeps pointing at them; missing items in use keep their old data and
  raise a check warning; per-item manual edits ask whether to keep or overwrite them.
- Price overrides for built-in items and cable lines, and box presets, are also stored
  in the project.
- The app ships no manufacturer price lists; the user downloads them.

## BOM rules

- Cable, per (cross-section, color): for each segment a conductor passes through,
  segment length + 2 × terminationSlack; summed, × (1 + waste%), rounded up to 1 m.
- Conduit, per catalog conduit: sum of segment lengths × (1 + waste%), rounded up to 1 m.
- Boxes, junction boxes, devices, blanking covers, plates: counted from nodes and
  their contents, including provision boxes.
- Panel: enclosure + every panel device.
- Each BOM line has a stable key (`itemId` or `cable:<section>:<color>`).

## Basic checks (warnings, never blocking)

1. Lighting circuit < 1.5 mm², sockets circuit < 2.5 mm².
2. Device rating above the section limit: > 10 A on 1.5 mm², > 16 A on 2.5 mm², > 25 A on 4 mm², > 32 A on 6 mm² (table editable in code constants).
3. Circuit whose protecting device has no RCD/RCBO upstream (or is not one).
4. Active terminal box not reached by any circuit (provision boxes exempt).
5. Conduit segment or node not connected to the panel through the conduit graph.
6. Conduit fill: inner Ø < conduitFillFactor × circumscribed Ø of the conductor bundle.
7. Box contents use more modules than the box provides.
8. Panel devices exceed rails × modulesPerRail, or overlap.
9. Active terminal box with no plate and no devices (provision boxes exempt).
10. An item used in the project is missing from the catalog that replaced its catalog,
    or is "price only" where technical attributes are needed (modules, diameters).

Each warning links to the offending element (selecting it on the plan/panel).

## Exports

- Project detail PDF: cover (project, client, address, date), one page per floor plan
  with conduits and nodes labeled, panel front view, circuit table, conduit/segment
  table with lengths, BOM, open warnings.
- Quote: PDF and CSV (`;` separator, UTF-8 with BOM for Excel) with code, description,
  quantity, unit, unit price, line total. Lines without a price are flagged.
  Quote settings are per project (`QuoteSettings` below):
  - material markup or discount percentage (positive = markup, negative = discount),
    applied to material lines;
  - labor lines entered by hand: lump sum (`description, amount`) or hourly
    (`description, hours, hourlyRate`);
  - VAT rate (default 22%, e.g. 10% for residential renovation);
  - totals: materials subtotal, labor subtotal, taxable amount, VAT, grand total.
  The quote PDF header shows the company data stored in the project: business name,
  VAT number, address, phone, email, logo. Company data comes from the app library
  (docs/specs/desktop-app.md).
- Unit prices come from the project's catalog items or from its price overrides, which
  also price built-in items and cable lines.
- "Issue quote" freezes a numbered snapshot (lines, unit prices, settings, totals,
  number, date) in the project's `quote.issued[]`; exports of an issued quote render
  from the snapshot, so later price edits never change it.
- Quotes are numbered per project: `max(issued.number) + 1`, printed together with the
  project name. Each issued quote has a status (`issued | approved | rejected |
  superseded`), `statusChangedAt` and a `note`. Issuing a new quote marks the previous
  pending (`issued`) ones superseded; approving one offers to mark the other pending
  ones rejected; at most one quote per project is approved. An issued quote is
  immutable except for its status and note. The quote list and the quote PDF show the
  status.

```ts
interface QuoteSettings {
  materialAdjustmentPercent: number; // default 0
  vatPercent: number;                // default 22
  laborLines: (
    | { kind: 'lump'; description: string; amount: number }
    | { kind: 'hourly'; description: string; hours: number; hourlyRate: number }
  )[];
}
```

## Start screen

New project, open file, recent files. There is no draft to resume and no template: see
docs/specs/desktop-app.md.

## Persistence

A project is one `.epd` file holding everything it needs; nothing outside the file
changes how a project looks or prices. The file is a zip:

```
manifest.json      { format: "epd", schemaVersion, appVersion, savedAt }
project.json       ProjectFile without assets
assets/<id>.<ext>  floor-plan PDFs and images, company logo
```

`ProjectFile` (zod schema in the domain module):

- `meta`: name, client name, address, createdAt
- `company`: business name, VAT number, address, phone, email, `logoAssetId?`
- `settings`: `ProjectSettings`
- `quote`: quote settings and `issued[]` snapshots
- `catalogs`: `ProjectCatalog[]`
- `priceOverrides`: prices for built-in items and cable lines
- `boxPresets`: `BoxPreset[]`
- `doc`: floors, nodes, segments, panels, circuits, extra runs

Versioning: `schemaVersion` is an integer; one pure migration function per version
step runs before validation. Old files always open (every migration is tested against a
frozen fixture of the previous version); a file from a newer app version is refused with
a clear message.

Saving, the recovery copy of the open project, company data, catalogs, price overrides
and box presets (the app library) changed with the desktop app: see docs/specs/desktop-app.md.
The `.epd` no longer holds company data, catalogs, price overrides or presets.

Editor has undo/redo for every document change.

## Acceptance Criteria

1. From the start screen a user creates a project, saves it as an `.epd` file, reopens it, and sees the same drawing, settings, company data, catalogs and quotes; with a draft present the start screen offers to resume it.
2. Importing a PDF (page selectable) or PNG/JPG sets it as a floor background; after calibrating two points 4.20 m apart, a segment drawn between those points measures 4.20 m ± 0.01.
3. A plan can be drawn with walls only (no background) and segments still measure in meters.
4. Reference fixture (default settings): panel at 1.50 m, junction box at 0.25 m, socket box at 0.30 m, segment S1 panel→JB 5.00 m plan length, S2 JB→socket 3.00 m, both run at floor, 20 mm conduit; circuit 2.5 mm² L+N+PE auto-routed to the socket. Then: S1 = 6.75 m, S2 = 3.55 m; BOM shows 13 m of 2.5 mm² for each of brown, blue, yellow-green, and 12 m of 20 mm conduit.
5. Two circuits sharing a trunk segment count that segment for each circuit's conductors; one circuit to two boxes through a shared trunk counts the trunk once.
6. Manual routing accepts only contiguous segment chains from panel to target; auto routing picks the shortest path.
7. Extra conductor runs (e.g. two travelers between two two-way switch boxes) add their conductors to the segments on their path and to the BOM.
8. A provision terminal box with no circuit and no contents adds its conduit and box to the BOM, adds no cable, and raises no "not reached" warning.
9. A terminal box with a plate and 3 blanking covers lists plate and covers in the BOM.
10. Two floors with a riser: floor 1 height 2.70 m, a riser between them measures 2.70 m and its conductors are counted.
11. Changing mounting heights in project A does not change project B.
12. The panel view supports 1 to N DIN rails (default 1); placing devices beyond capacity or overlapping triggers check 8.
13. Each of checks 1–9 has a fixture that triggers it and one that does not.
14. A new project from a template copies settings, company data, catalogs, price overrides and box presets, and nothing of the drawing or the quotes.
15. Project PDF and quote PDF/CSV export; the CSV opens in Excel with correct columns and totals.
15b. Quote math fixture: materials 1,000.00, adjustment +10%, labor lump 300.00 + 8 h × 35.00, VAT 22% → materials 1,100.00, labor 580.00, taxable 1,680.00, VAT 369.60, total 2,049.60.
15c. The quote PDF header shows the business profile fields and logo when set, and omits empty ones.
16. UI available in English and Italian; switching language changes all visible strings; no hard-coded user-facing strings outside locale files.
17. A file saved by an older schema version opens after migration (frozen fixture per version); a file from a newer version is refused with a message.
17b. Replacing a catalog keeps item ids matched by code, so BOM lines stay; an item in use that is missing from the new catalog keeps its data and raises check 10.
17c. Issuing quote 2 marks quote 1 superseded; approving one quote leaves at most one approved per project; issued quote lines never change.
18. Each test in the Testing Plan states its card: `protects=...; fails_when=...; no_claim=...`.

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit | segment length (floor/ceiling/direct/riser), calibration scale, shortest path + union, manual chain validation, BOM aggregation and rounding, conduit fill, each check, settings isolation | ~40 |
| Unit | project file schema, migrations with frozen fixtures, `.epd` zip round trip, catalog merge and replace-by-code diff, CSV mapping, quote numbering and status rules | ~25 |
| Integration | draft repository (IndexedDB), file access fallback | ~5 |
| E2E | start screen → open `.epd` (fake file access) → import + calibrate → draw → circuit → BOM; panel rails; export; save (bytes read back); app opens offline | ~7 |

## Milestones (child issues)

| # | Title | Depends on |
|---|---|---|
| 1 | Scaffold, i18n, Supabase auth, project list, CLAUDE.md | — |
| 2 | Domain core: model, lengths, routing, BOM, checks (pure, tested) | 1 |
| 3 | Plan editor: floors, background import + calibration, walls, nodes, segments, risers, undo/redo, autosave | 2 |
| 4 | Catalog + terminal box contents + provision status | 2 |
| 5 | Panel designer (DIN rails, devices, hierarchy) + circuits | 2, 4 |
| 6 | Routing UI: auto/manual, extra conductor runs | 3, 5 |
| 7 | BOM view, checks panel, PDF/CSV exports | 3–6 |
| 8 | Mobile light view + purchase checklist sync (removed by 9) | 7 |
| 9 | Backend-free, file-based app: `.epd` files, draft, start screen, per-project catalogs and company data, quote status, PWA; Supabase, accounts and mobile view removed (docs/plans/local-first.md) | 1–8 |

Domain core comes first because every UI milestone renders its results; getting the
length and BOM math right in isolation is cheaper than debugging it through the canvas.

## Rollback Plan

No existing users or data. Each milestone is a separate set of commits that can be
reverted. After milestone 9, project file schema changes ship as a version bump plus a
migration and a frozen fixture, so files saved by any earlier version keep opening.

## Out of Scope (v1)

- Automatic wall/room recognition from images.
- Single-line diagram (schema unifilare) drawing.
- Electrical calculations: voltage drop, ampacity derating, load balancing, protection coordination.
- Brand catalogs (BTicino, Vimar...) shipped with the app; the user imports price lists.
- XLSX catalog import (CSV and `.epc` only).
- Accounts, cloud sync, teams, sharing with clients; a phone view (users read the PDFs).
- Native apps for other platforms (Linux, mobile).
- Comparing the current BOM with the approved quote to price change orders.
- DWG/DXF import/export.
- Pack sizes (cable coils, conduit rolls) in the BOM and quote: v1 uses exact meters.
