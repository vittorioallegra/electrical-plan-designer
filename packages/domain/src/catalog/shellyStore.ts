// Prices of the built-in Shelly models from Shelly's online store (docs/specs/shelly-prices.md):
// which store product each item is, and how a store price (with VAT, maybe a pack) becomes the
// net price of one piece.
import type { PriceOverrides } from '../types';
import { standardVatRates, type EuroCountry } from '../vatRates';
import { builtinById, shellyCatalog } from './builtin';

export interface ShellyStoreProduct {
  /** The product's handle on shelly.com (`/products/<handle>.js`). */
  handle: string;
  /** Pieces in one store product (the 2PM Gen3 sells as a 2-pack). */
  packSize: number;
}

/** The store product of each built-in Shelly item. */
export const shellyStoreProducts: Readonly<Record<string, ShellyStoreProduct>> = {
  'builtin:shelly_pro_1': { handle: 'shelly-pro-1', packSize: 1 },
  'builtin:shelly_pro_1pm': { handle: 'shelly-pro-1pm', packSize: 1 },
  'builtin:shelly_pro_2': { handle: 'shelly-pro-2', packSize: 1 },
  'builtin:shelly_pro_2pm': { handle: 'shelly-pro-2pm', packSize: 1 },
  'builtin:shelly_pro_3': { handle: 'shelly-pro-3', packSize: 1 },
  'builtin:shelly_pro_4pm': { handle: 'shelly-pro-4pm', packSize: 1 },
  'builtin:shelly_pro_em_50': { handle: 'shelly-pro-em-50', packSize: 1 },
  'builtin:shelly_1_gen3': { handle: 'shelly-1-gen3', packSize: 1 },
  'builtin:shelly_1pm_gen3': { handle: 'shelly-1pm-gen3', packSize: 1 },
  'builtin:shelly_1_mini_gen3': { handle: 'shelly-1-mini-gen3', packSize: 1 },
  'builtin:shelly_1pm_mini_gen3': { handle: 'shelly-1pm-mini-gen3', packSize: 1 },
  'builtin:shelly_2pm_gen3': { handle: 'shelly-2pm-gen3', packSize: 2 },
};

/** The handles to ask the store for, in catalog order. */
export function shellyStoreHandles(): string[] {
  return shellyCatalog.flatMap((i) => shellyStoreProducts[i.id]?.handle ?? []);
}

/** The net price in cents of one piece: the store price without the country's VAT. */
export function netPriceCents(grossCents: number, packSize: number, country: EuroCountry): number {
  return Math.round((grossCents * 10000) / (packSize * (10000 + standardVatRates[country])));
}

/** How the store answered for one product (the bridge's `StorePrice`). */
export type StorePriceStatus =
  'ok' | 'unavailable' | 'not_found' | 'rate_limited' | 'failed' | 'wrong_currency';

export interface StorePrice {
  handle: string;
  status: StorePriceStatus;
  /** Price with VAT in cents, for `ok` and `unavailable`. */
  priceCents?: number;
  sku?: string;
}

export interface ShellyPriceRow {
  itemId: string;
  status: StorePriceStatus;
  /** The library's price today (an override), if any. */
  current?: number | undefined;
  /** The new net price, when the store gave one. */
  next?: number | undefined;
  sku?: string | undefined;
  /** The row can be applied: a price came back. */
  applicable: boolean;
  /** Applying it changes the library (a new price or a new code). */
  changed: boolean;
}

/** One row per Shelly item, from the store's answers and the library's current prices. */
export function shellyPriceRows(
  prices: readonly StorePrice[],
  overrides: PriceOverrides,
  country: EuroCountry,
): ShellyPriceRow[] {
  const byHandle = new Map(prices.map((p) => [p.handle, p]));
  return shellyCatalog.flatMap((item) => {
    const product = shellyStoreProducts[item.id];
    if (!product) return [];
    const answer = byHandle.get(product.handle);
    const current = overrides[item.id]?.unitPrice;
    const status = answer?.status ?? 'failed';
    const applicable =
      (status === 'ok' || status === 'unavailable') && answer?.priceCents !== undefined;
    const next = applicable
      ? netPriceCents(answer!.priceCents!, product.packSize, country)
      : undefined;
    const sku = applicable ? answer!.sku : undefined;
    const code = overrides[item.id]?.code ?? item.code;
    const changed = applicable && (next !== current || (sku !== undefined && sku !== code));
    return [{ itemId: item.id, status, current, next, sku, applicable, changed }];
  });
}

/**
 * The overrides after applying the chosen rows: the price, and the store's code when it differs
 * from the built-in item's (a code the user typed is kept when the store gives none).
 */
export function applyShellyPrices(
  overrides: PriceOverrides,
  rows: readonly ShellyPriceRow[],
  chosen: ReadonlySet<string>,
): PriceOverrides {
  const next = { ...overrides };
  for (const row of rows) {
    if (!row.applicable || row.next === undefined || !chosen.has(row.itemId)) continue;
    const code = row.sku ?? overrides[row.itemId]?.code;
    const own = code && code !== builtinById.get(row.itemId)?.code ? { code } : {};
    next[row.itemId] = { unitPrice: row.next, ...own };
  }
  return next;
}
