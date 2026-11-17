import { describe, expect, it } from 'vitest';
import {
  canFeedCircuit,
  isRailItem,
  isSmartBox,
  isSmartDin,
  missingAttributes,
} from './attributes';
import type { CatalogItem } from './types';

const smart = (attributes: CatalogItem['attributes'], modules?: number): CatalogItem => ({
  id: 'c:S',
  category: 'smart_device',
  name: 'Smart',
  unit: 'pcs',
  attributes,
  ...(modules === undefined ? {} : { modules }),
});

describe('smart device attributes', () => {
  // protects=smart devices are placed by mount; fails_when=a DIN device is not a rail item, a box device is, or a panel device stops being one; no_claim=UI lists
  it('tells DIN devices from box devices', () => {
    const din = smart({ smartMount: 'din' }, 4);
    const box = smart({ smartMount: 'box' });
    expect([isSmartDin(din), isSmartBox(din), isRailItem(din)]).toEqual([true, false, true]);
    expect([isSmartDin(box), isSmartBox(box), isRailItem(box)]).toEqual([false, true, false]);
    const mcb = { category: 'panel_device', attributes: {} } as const;
    expect(isRailItem(mcb)).toBe(true);
  });

  // protects=incomplete smart items are price only; fails_when=a smart item without mount, or a DIN one without width, counts as complete, or a box one needs modules; no_claim=other categories
  it('needs the mount, and the width on a DIN rail', () => {
    expect(missingAttributes(smart({}))).toEqual(['smartMount']);
    expect(missingAttributes(smart({ smartMount: 'din' }))).toEqual(['modules']);
    expect(missingAttributes(smart({ smartMount: 'din' }, 1))).toEqual([]);
    expect(missingAttributes(smart({ smartMount: 'box' }))).toEqual([]);
  });

  // protects=circuits start at protective devices only; fails_when=a smart device can feed a circuit, or a panel device or a missing item cannot; no_claim=device types
  it('never lets a smart device feed a circuit', () => {
    expect(canFeedCircuit(smart({ smartMount: 'din' }, 1))).toBe(false);
    expect(canFeedCircuit({ category: 'panel_device' })).toBe(true);
    expect(canFeedCircuit(undefined)).toBe(true);
  });
});
