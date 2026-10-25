import { describe, expect, it } from 'vitest';
import { builtinCatalog } from './catalog/builtin';
import { createCatalogLookup } from './catalog/lookup';
import { runChecks } from './checks';
import { defaultProjectSettings } from './defaults';
import { firstFreeSlot, isFree, suggestEnclosure, totalModules } from './panel';
import { ac4Doc } from './testing/builders';

const catalog = createCatalogLookup();
const enclosures = builtinCatalog.filter((i) => i.category === 'enclosure');

describe('panel layout', () => {
  // protects=slot placement; fails_when=a device is placed over another or past the rail end; no_claim=drag and drop
  it('finds the first free slot and respects device widths', () => {
    const panel = ac4Doc().panels[0]!; // RCD 0–1, MCB 2, MCB 3
    expect(firstFreeSlot(panel, catalog, 2)).toEqual({ rail: 0, slot: 4 });
    expect(isFree(panel, catalog, 0, 1, 1)).toBe(false);
    expect(isFree(panel, catalog, 0, 11, 2)).toBe(false);
    expect(isFree(panel, catalog, 1, 0, 1)).toBe(false);
    expect(isFree(panel, catalog, 0, 2, 1, 'mcb16')).toBe(true);
  });

  // protects=AC 12 rails; fails_when=a full rail does not spill to the next rail; no_claim=—
  it('AC 12: uses a second rail when the first is full', () => {
    const panel = { ...ac4Doc().panels[0]!, dinRails: 2, modulesPerRail: 4 };
    expect(firstFreeSlot(panel, catalog, 2)).toEqual({ rail: 1, slot: 0 });
    expect(firstFreeSlot({ ...panel, dinRails: 1 }, catalog, 2)).toBeNull();
  });

  // protects=enclosure suggestion; fails_when=the suggestion is too small or not the smallest fit; no_claim=brand sizes
  it('suggests the smallest enclosure that fits', () => {
    expect(totalModules(ac4Doc().panels[0]!, catalog)).toBe(4);
    expect(suggestEnclosure(4, enclosures)?.id).toBe('builtin:enclosure_12m');
    expect(suggestEnclosure(13, enclosures)?.id).toBe('builtin:enclosure_24m');
    expect(suggestEnclosure(40, enclosures)).toBeUndefined();
  });

  // protects=AC 12 / check 8 through layout edits; fails_when=overlap or overflow is not flagged; no_claim=—
  it('AC 12: devices beyond capacity or overlapping trigger check 8', () => {
    const d = ac4Doc();
    d.panels[0]!.devices.push({
      id: 'x',
      itemId: 'builtin:mcb_1pn_c10',
      rail: 0,
      slot: 1,
      label: 'x',
    });
    const warnings = runChecks(d, defaultProjectSettings(), catalog).filter(
      (w) => w.id === 'panel_capacity',
    );
    expect(warnings.map((w) => [w.elementRef.id, w.params.reason])).toEqual([
      ['rcd', 'overlap'],
      ['x', 'overlap'],
    ]);
  });
});
