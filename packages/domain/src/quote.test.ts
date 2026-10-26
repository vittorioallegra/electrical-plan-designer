import { describe, expect, it } from 'vitest';
import { computeBom, type BomLine } from './bom';
import { builtinById } from './catalog/builtin';
import { createCatalogLookup } from './catalog/lookup';
import type { CatalogItem } from './catalog/types';
import { defaultProjectSettings, defaultQuoteSettings } from './defaults';
import { computeQuote, issueQuote, lookupPrice, type PriceContext } from './quote';
import { ac4Doc } from './testing/builders';
import type { QuoteSettings } from './types';

const userSocket: CatalogItem = {
  id: 'u1',
  category: 'device',
  name: 'Brand socket',
  code: 'BR-123',
  unitPrice: 450,
  unit: 'pcs',
  modules: 1,
  attributes: { deviceType: 'socket' },
};

function ctx(
  cablePrices: PriceContext['cablePrices'] = {},
  items: CatalogItem[] = [],
): PriceContext {
  return { catalog: createCatalogLookup(items), cablePrices };
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

  // protects=pricing from the project's copies; fails_when=a copy's price is ignored, a built-in copy loses to the built-in, or a missing price counts as zero; no_claim=how copies are made
  it('prices a line from the project copy, or leaves it unpriced', () => {
    const line: BomLine = { key: 'u1', category: 'device', itemId: 'u1', quantity: 2, unit: 'pcs' };
    expect(lookupPrice(line, ctx({}, [userSocket]))).toEqual({
      unitPrice: 450,
      code: 'BR-123',
      source: 'item',
    });
    const { unitPrice: _unitPrice, ...noPrice } = userSocket;
    expect(lookupPrice(line, ctx({}, [noPrice]))).toEqual({
      unitPrice: null,
      code: 'BR-123',
      source: 'none',
    });
    const box: BomLine = {
      key: 'builtin:box_503',
      category: 'box',
      itemId: 'builtin:box_503',
      quantity: 1,
      unit: 'pcs',
    };
    const copy: CatalogItem = { ...builtinById.get('builtin:box_503')!, unitPrice: 120 };
    expect(lookupPrice(box, ctx({}, [copy])).unitPrice).toBe(120);
    expect(lookupPrice(box, ctx()).unitPrice).toBeNull();
  });

  // protects=quote from copies alone; fails_when=a BOM line of the demo drawing is priced from anything but the project's items and cable prices; no_claim=rounding of totals
  it('prices the BOM from item copies and cable prices only', () => {
    const bom = computeBom(ac4Doc(), defaultProjectSettings(), createCatalogLookup());
    const box: CatalogItem = { ...builtinById.get('builtin:box_503')!, unitPrice: 120 };
    const { lines } = computeQuote(
      bom,
      ctx({ 'cable:2.5:brown': { unitPrice: 55, code: 'C25M' } }, [box]),
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
    expect(lines.find((l) => l.key === 'cable:2.5:blue')?.unitPrice).toBeNull();
  });
});

describe('issued quotes', () => {
  // protects=frozen snapshots; fails_when=a price edit after issuing changes the issued quote or the snapshot is not pending; no_claim=storage
  it('an issued snapshot is unchanged after a price edit', () => {
    const bom = computeBom(ac4Doc(), defaultProjectSettings(), createCatalogLookup());
    const box: CatalogItem = { ...builtinById.get('builtin:box_503')!, unitPrice: 120 };
    const settings = defaultQuoteSettings();
    const issued = issueQuote(
      bom,
      ctx({}, [box]),
      settings,
      describeLine,
      7,
      new Date('2026-10-25T10:00:00Z'),
      'en',
    );
    const before = structuredClone(issued);
    box.unitPrice = 999;
    settings.vatPercent = 10;
    expect(issued).toEqual(before);
    expect(issued).toMatchObject({ status: 'issued', note: '' });
    expect(issued.number).toBe(7);
  });
});
