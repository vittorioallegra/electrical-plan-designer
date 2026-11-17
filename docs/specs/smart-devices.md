# Spec: Smart devices (Shelly)

Status: implemented (2026-11-17); decisions agreed with the user the same day.

## Context

Electricians add smart relays, dimmers and meters to a job, mostly Shelly. Where a model goes
depends on its form factor:

- **DIN models** (the Pro line, Pro EM-50) sit on a DIN rail in the panel and take modules there,
  like an MCB. They do not protect anything: a circuit still starts at its MCB or RCBO.
- **In-box models** (1, 1PM, Mini, 2PM, …) sit behind a device in a flush box, or
  in a junction box. They take no module on the plate, but they fill the box: a 503 behind two
  switches has room for about one.

Today they can only be typed in as `device` or `panel_device` items, and both are wrong: an
in-box relay as a `device` takes plate modules; a Pro as a `panel_device` can be picked as the
origin of a circuit.

## Current State (verified 2026-11-17, commit d0a564f)

| Concern | Today | Where |
|---|---|---|
| Categories | `device`, `blanking_cover`, `plate`, `box`, `junction_box`, `conduit`, `cable`, `panel_device`, `enclosure` | `packages/domain/src/catalog/schema.ts` |
| Built-in catalog | Generic items, names are i18n keys, ids `builtin:<slug>` stable forever | `catalog/builtin.ts` |
| Panel space | A panel device takes `modules` slots on a rail | `panel.ts`, `checks.ts` (`panel_capacity`) |
| Box space | Contents use their `modules` against the plate's (or the box's); no `modules` counts 0 | `checks.ts` (`boxModules`, `box_modules`) |
| Box contents UI | Terminal boxes only: devices, blanking covers, plate | `features/editor/components/BoxContents.tsx`, `NodeInspector.tsx` |
| Formats | `.epd` doc and manifest, `.epc`, library: all at version 1, released since v0.1.0 | `schema.ts`, `projectFile/migrations.ts`, `catalog/epc.ts`, `library.ts` |

## Proposed Change

### 1. Model

- New catalog category **`smart_device`**.
- New attributes on catalog items:
  - `smartMount: 'din' | 'box'`. Like other technical attributes it is not enforced by the
    schema: a `smart_device` without it (or a `din` one without `modules`) is "price only"
    (`catalog/attributes.ts`) and warns `price_only`;
  - `channels` (positive integer, optional): outputs or inputs, shown in the item name only.
- A `din` item has `modules` (its width on the rail). A `box` item has no `modules`.

### 2. Built-in Shelly catalog

Shelly models ship as built-in items with ids `builtin:shelly_<slug>`, grouped in a built-in
catalog of their own: Settings › Catalog lists "Shelly catalog" next to "Built-in catalog"
(`builtinCatalogs` in `catalog/builtin.ts`), and the Catalog column shows "Shelly". Like the other
built-ins they cannot be removed and are priced with library overrides. Their names stay
i18n keys (`catalog.builtin.shelly_<slug>`); the value is the model name, the same in every
language (`Shelly Pro 4PM`). There are no prices, as with every built-in item. Each item
carries Shelly's product code (`FG…`, the store's SKU; the 2PM Gen3's is its 2-pack's).

DIN widths from Shelly's knowledge base (kb.shelly.cloud, 2026-11-17): Pro 1, Pro 1PM, Pro 2,
Pro 2PM and Pro EM-50 are 19 mm (1 module); Pro 3 and Pro 4PM are 53 mm (3 modules).
Ids are stored in projects and never change; a width fixed later reaches projects through
"Update from catalog".

| Mount | Models |
|---|---|
| `din` | Pro 1, Pro 1PM, Pro 2, Pro 2PM, Pro 3, Pro 4PM, Pro EM-50 |
| `box` | 1 Gen3, 1PM Gen3, 1 Mini Gen3, 1PM Mini Gen3, 2PM Gen3 (ids `builtin:shelly_<model>_gen3`) |

Users can still add their own `smart_device` items (Settings › Catalog, CSV, `.epc`).

### 3. Panel

- The device palette lists `din` smart devices next to the panel devices, in their own group.
- They take their modules on the rail, count against the enclosure's capacity
  (`panel_capacity`), and can be placed downstream of a device (`upstreamDeviceId`).
- They are never the origin of a circuit: the circuit editor and "New circuit" do not offer
  them (`canFeedCircuit`). The document schema cannot see items, so it does not enforce this.

### 4. Boxes

- Terminal boxes **and junction boxes** can hold `box` smart devices. Terminal boxes get a
  "Smart devices" group in their contents; junction boxes get a contents section with only
  that group.
- They take no plate modules: the modules counter and `box_modules` ignore them.
- **New check `box_smart_crowded`** (warning): a box with 3 modules or fewer (a 503) holding
  more than one smart device. The limit (1 per box of ≤ 3 modules) is one domain constant.
  Junction boxes and larger flush boxes are never warned.
- A terminal box holding only smart devices still warns `box_empty` (there is nothing on the
  wall).

### 5. BOM, quote, exports

- BOM and quote list smart devices in their own section, "Smart devices", after the panel
  devices; the PDF and CSV exports follow the BOM.
- The CSV import accepts `smart_device` (and `smart`, `domotica`, `dispositivi smart`) as
  category. The mount follows the module width: with modules `din`, without `box`.
- Settings › Catalog: the item dialog and detail panel have Mounting and Channels fields; box
  presets accept in-box smart devices.

### 6. File formats

Adding a category is a format change (an older app would refuse or misread the file). Each
format bumps to version 2 with a migration that changes nothing but the version, a test, and a
frozen copy of the version 1 fixture:

- project file (`PROJECT_FILE_SCHEMA_VERSION`, `projectFile/migrations.ts`), which holds the
  item copies; the project doc (`doc.schemaVersion`) holds no catalog items and stays at 1;
- catalog file `.epc` (`EPC_SCHEMA_VERSION`; fixture `catalog/fixtures/v1.epc.json`);
- library (`LIBRARY_SCHEMA_VERSION`, `migrateLibrary`; fixture `library/fixtures/v1.json`).
  The desktop app writes an older `library.json` back at version 2 on load, so an older app
  refuses the library instead of setting aside catalog files it cannot read.

An older app opening a version 2 file shows its "made with a newer version" error, as today.
`pnpm demo:epd` is rerun.

## Out of scope

- Wiring a smart device into a circuit (which loads it switches, its input from a push
  button): a later step if needed.
- Box depth or volume per model; the 503 rule is the only space check.
- Other brands' built-in models (users add them as their own items).
- The Pro 3EM (three-phase meter, sold in two versions): left out on 2026-11-17.
- Shelly dimmers (Pro Dimmer, in-box Dimmer), i4 and RGBW: left out of the first built-in list;
  users can add them as their own items.

## Open questions

- Should 504 and 506 boxes get a limit too (e.g. 2)? Proposed: no, until asked.
