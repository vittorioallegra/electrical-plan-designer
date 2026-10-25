import { describe, expect, it } from 'vitest';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import { createCatalogLookup } from '@epd/domain/catalog/lookup';
import type { PanelDevice } from '@epd/domain/types';
import { rcdGroupColors } from './rcdGroups';

const lookup = createCatalogLookup([]);
const rcd = builtinCatalog.find((i) => i.attributes.panelDeviceType === 'rcd')!;
const mcb = builtinCatalog.find((i) => i.attributes.panelDeviceType === 'mcb')!;
const device = (id: string, itemId: string, upstreamDeviceId?: string) =>
  ({
    id,
    itemId,
    rail: 0,
    slot: 0,
    label: id,
    ...(upstreamDeviceId ? { upstreamDeviceId } : {}),
  }) as PanelDevice;

describe('RCD group colors', () => {
  // protects=RCD grouping on the panel front; fails_when=a device downstream of an RCD (directly or through a chain) gets another color or none; no_claim=color palette choice
  it('gives each RCD a color shared by the devices downstream of it', () => {
    const colors = rcdGroupColors(
      [
        device('r1', rcd.id),
        device('r2', rcd.id),
        device('m1', mcb.id, 'r1'),
        device('m2', mcb.id, 'm1'),
        device('m3', mcb.id, 'r2'),
        device('m4', mcb.id),
      ],
      lookup,
    );
    expect(colors.get('r1')).not.toBe(colors.get('r2'));
    expect(colors.get('m1')).toBe(colors.get('r1'));
    expect(colors.get('m2')).toBe(colors.get('r1'));
    expect(colors.get('m3')).toBe(colors.get('r2'));
    expect(colors.has('m4')).toBe(false);
  });
});
