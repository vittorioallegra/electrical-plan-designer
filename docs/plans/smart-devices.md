# Plan: Smart devices (Shelly)

Implements docs/specs/smart-devices.md. Done 2026-11-17 (all steps); the UI flows are
covered by jsdom tests (palette, circuit device list, box contents) instead of browser E2E.

Every step ends with typecheck, lint and the tests of the touched packages green; `pnpm verify` runs once at the end. New tests carry the card
comment (`// protects=...; fails_when=...; no_claim=...`).

## Steps

1. **Formats to version 2.** Bump the project file, `.epc` and library schema versions (the doc
   holds no items and stays at 1);
   add identity migrations with tests; freeze the current fixtures as `v1` copies (the existing
   `projectFile/fixtures/v1.json` stays as is) and test that each opens with the new app.
   No model change yet, so this lands on its own.
2. **Domain model.** `smart_device` category, `smartMount` and `channels` attributes, schema
   refinement (`smartMount` required for the category; `din` needs `modules`). Doc validation:
   a circuit's `panelDeviceId` must not point at a smart device.
3. **Built-in Shelly items.** Check DIN widths against the Shelly datasheets, then add the items
   to `catalog/builtin.ts` and their names to `en.json` and `it.json`
   (`builtin-names.test.ts` covers the keys).
4. **Checks.** `boxModules` ignores smart devices; new `box_smart_crowded` warning with its
   messages in both locales; tests for 503 with 1 and 2, 504 with 2, junction box with 3.
5. **Panel UI.** Smart DIN group in `DevicePalette`; circuit editor filters smart devices out
   of the origin list. Browser E2E: place a Pro 4PM, capacity counts it.
6. **Box UI.** Smart devices group in `BoxContents`; contents section on junction boxes
   (`NodeInspector`). Box presets (`PresetsPage`) accept smart devices. E2E: add two Minis to a
   503, see the warning.
7. **BOM, quote, CSV, Settings.** BOM category order and labels; quote section; CSV category
   aliases and `mount` column; Settings › Catalog item dialog with the mount field.
8. **Wrap up.** `pnpm demo:epd`, `pnpm verify`, update `CLAUDE.md` if conventions changed, mark
   the spec implemented.
