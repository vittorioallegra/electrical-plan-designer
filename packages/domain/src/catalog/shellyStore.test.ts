import { describe, expect, it } from 'vitest';
import { shellyCatalog } from './builtin';
import {
  applyShellyPrices,
  netPriceCents,
  shellyPriceRows,
  shellyStoreHandles,
  shellyStoreProducts,
  type StorePrice,
} from './shellyStore';

describe('Shelly store prices', () => {
  // protects=every Shelly item can be priced from the store; fails_when=a Shelly item has no store product, two items share one, or a product points at an item that is not in the Shelly catalog; no_claim=that the handles still exist on shelly.com
  it('maps every Shelly item to one store product', () => {
    expect(Object.keys(shellyStoreProducts).sort()).toEqual(shellyCatalog.map((i) => i.id).sort());
    expect(new Set(shellyStoreHandles()).size).toBe(shellyCatalog.length);
  });

  // protects=net price maths; fails_when=the country's VAT, the pack size or the rounding is applied wrongly; no_claim=the store's own prices
  it('removes the country VAT and splits packs', () => {
    expect(netPriceCents(11790, 1, 'IT')).toBe(9664);
    expect(netPriceCents(11790, 1, 'DE')).toBe(9908);
    expect(netPriceCents(11790, 1, 'FI')).toBe(9394);
    expect(netPriceCents(3890, 2, 'IT')).toBe(1594);
  });

  // protects=the preview and what applying writes; fails_when=a row without a price can be applied, an unchanged row counts as changed, a sold-out price is dropped, a new store code is lost, the built-in code is copied into the override, or unticked rows are written; no_claim=the dialog
  it('builds preview rows and applies the chosen ones', () => {
    const prices: StorePrice[] = [
      { handle: 'shelly-pro-4pm', status: 'ok', priceCents: 11790, sku: 'FG3800235268049' },
      { handle: 'shelly-pro-1', status: 'ok', priceCents: 5990, sku: 'FG3800235268001' },
      { handle: 'shelly-pro-2', status: 'ok', priceCents: 7090, sku: 'FG-NEW' },
      { handle: 'shelly-2pm-gen3', status: 'unavailable', priceCents: 3890 },
      { handle: 'shelly-1-gen3', status: 'not_found' },
    ];
    const overrides = {
      'builtin:shelly_pro_1': { unitPrice: 4910 },
      'builtin:shelly_pro_2': { unitPrice: 5811 },
      'builtin:shelly_1_gen3': { unitPrice: 1000 },
    };
    const rows = shellyPriceRows(prices, overrides, 'IT');
    expect(rows).toHaveLength(shellyCatalog.length);
    const row = (id: string) => rows.find((r) => r.itemId === `builtin:shelly_${id}`)!;
    expect(row('pro_4pm')).toMatchObject({ next: 9664, applicable: true, changed: true });
    expect(row('pro_1')).toMatchObject({ current: 4910, next: 4910, changed: false });
    expect(row('pro_2')).toMatchObject({ current: 5811, next: 5811, changed: true });
    expect(row('2pm_gen3')).toMatchObject({ status: 'unavailable', next: 1594, applicable: true });
    expect(row('1_gen3')).toMatchObject({ status: 'not_found', current: 1000, applicable: false });
    expect(row('pro_3')).toMatchObject({ status: 'failed', applicable: false });

    const chosen = new Set([
      'builtin:shelly_pro_4pm',
      'builtin:shelly_pro_2',
      'builtin:shelly_1_gen3',
    ]);
    expect(applyShellyPrices(overrides, rows, chosen)).toEqual({
      ...overrides,
      'builtin:shelly_pro_4pm': { unitPrice: 9664 },
      'builtin:shelly_pro_2': { unitPrice: 5811, code: 'FG-NEW' },
    });
  });
});
