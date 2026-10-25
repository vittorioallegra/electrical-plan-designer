import { describe, expect, it } from 'vitest';
import { computeBom, type BomLine } from './bom';
import { createCatalogLookup } from './catalog/lookup';
import type { CatalogItem } from './catalog/types';
import { defaultProjectSettings, defaultQuoteSettings } from './defaults';
import {
  computeQuote,
  formatQuoteNumber,
  issueQuote,
  lookupPrice,
  type PriceContext,
} from './quote';
import { ac4Doc } from './testing/builders';
import type { QuoteSettings } from './types';

const userSocket: CatalogItem = {
  id: 'u1',
  ownerId: 'user-a',
  category: 'device',
  name: 'Brand socket',
  code: 'BR-123',
  unitPrice: 450,
  unit: 'pcs',
  modules: 1,
  attributes: { deviceType: 'socket' },
};

function ctx(
  overrides: PriceContext['overrides'] = {},
  userItems: CatalogItem[] = [],
): PriceContext {
  return { catalog: createCatalogLookup(userItems), userItems, overrides };
}

const describeLine = (l: BomLine) => l.key;

describe('quote math', () => {
  // protects=AC 15b totals; fails_when=any subtotal, VAT or total differs from the spec fixture; no_claim=PDF layout
  it('AC 15b: materials 1,000.00 +10%, labor 300 + 8 h × 35, VAT 22%', () => {
    const bom: BomLine[] = [
      { key: 'u1', category: 'device', itemId: 'u1', quantity: 1, unit: 'pcs' },
    ];
    const item = { ...userSocket, unitPrice: 100_000 };
    const settings: QuoteSettings = {
      materialAdjustmentPercent: 10,
      vatPercent: 22,
      laborLines: [
        { kind: 'lump', description: 'Setup', amount: 300 },
        { kind: 'hourly', description: 'Install', hours: 8, hourlyRate: 35 },
      ],
    };
    const { totals } = computeQuote(bom, ctx({}, [item]), settings, describeLine);
    expect(totals).toEqual({
      materialsBeforeAdjustment: 100_000,
      adjustment: 10_000,
      materials: 110_000,
      labor: 58_000,
      taxable: 168_000,
      vat: 36_960,
      total: 204_960,
      unpricedCount: 0,
    });
  });

  // protects=unpriced flagging; fails_when=an unpriced line counts as zero silently; no_claim=—
  it('flags unpriced lines and leaves them out of the totals', () => {
    const bom = computeBom(ac4Doc(), defaultProjectSettings(), createCatalogLookup());
    const { lines, totals } = computeQuote(bom, ctx(), defaultQuoteSettings(), describeLine);
    expect(lines.every((l) => l.unitPrice === null && l.total === null)).toBe(true);
    expect(totals.unpricedCount).toBe(bom.length);
    expect(totals.total).toBe(0);
  });

  // protects=price lookup order; fails_when=a user item price loses to an override; no_claim=—
  it('looks up user item price, then override, then unpriced', () => {
    const line: BomLine = { key: 'u1', category: 'device', itemId: 'u1', quantity: 2, unit: 'pcs' };
    expect(lookupPrice(line, ctx({ u1: { unitPrice: 999 } }, [userSocket]))).toEqual({
      unitPrice: 450,
      code: 'BR-123',
      source: 'item',
    });
    const noPrice = { ...userSocket, unitPrice: undefined };
    expect(lookupPrice(line, ctx({ u1: { unitPrice: 999 } }, [noPrice])).source).toBe('override');
    expect(lookupPrice(line, ctx({}, [noPrice])).source).toBe('none');
  });

  // protects=pricing built-ins and cable lines; fails_when=an override does not price a built-in or a cable line; no_claim=—
  it('an override prices a built-in line and a cable line', () => {
    const bom = computeBom(ac4Doc(), defaultProjectSettings(), createCatalogLookup());
    const { lines } = computeQuote(
      bom,
      ctx({
        'builtin:box_503': { unitPrice: 120 },
        'cable:2.5:brown': { unitPrice: 55, code: 'C25M' },
      }),
      defaultQuoteSettings(),
      describeLine,
    );
    expect(lines.find((l) => l.key === 'builtin:box_503')?.total).toBe(120);
    expect(lines.find((l) => l.key === 'cable:2.5:brown')).toMatchObject({
      code: 'C25M',
      quantity: 13,
      unitPrice: 55,
      total: 715,
    });
  });

  // protects=user cable items price cable lines; fails_when=a matching user cable item is ignored; no_claim=—
  it('a priced user cable item prices the matching cable line', () => {
    const cable: CatalogItem = {
      id: 'u-cable',
      ownerId: 'user-a',
      category: 'cable',
      name: 'Brown 2.5',
      unitPrice: 60,
      unit: 'm',
      attributes: { crossSection: 2.5, color: 'brown', outerDiameter: 3.6 },
    };
    const line: BomLine = {
      key: 'cable:2.5:brown',
      category: 'cable',
      cable: { crossSection: 2.5, color: 'brown' },
      quantity: 13,
      unit: 'm',
    };
    expect(lookupPrice(line, ctx({}, [cable])).unitPrice).toBe(60);
  });
});

describe('issued quotes', () => {
  // protects=frozen snapshots; fails_when=a price edit after issuing changes the issued quote; no_claim=storage
  it('an issued snapshot is unchanged after a price edit', () => {
    const bom = computeBom(ac4Doc(), defaultProjectSettings(), createCatalogLookup());
    const overrides = { 'builtin:box_503': { unitPrice: 120 } };
    const settings = defaultQuoteSettings();
    const issued = issueQuote(
      bom,
      ctx(overrides),
      settings,
      describeLine,
      7,
      new Date('2026-10-25T10:00:00Z'),
      'en',
    );
    const before = structuredClone(issued);
    overrides['builtin:box_503'].unitPrice = 999;
    settings.vatPercent = 10;
    expect(issued).toEqual(before);
    expect(formatQuoteNumber(issued)).toBe('2026-007');
  });
});
