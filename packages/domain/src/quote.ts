// Quote math in integer cents. Material lines come from the BOM; labor is typed by hand.
import type { BomLine } from './bom';
import type { CatalogLookup } from './catalog/lookup';
import type { CablePrices, IssuedQuote, QuoteLine, QuoteSettings, QuoteTotals } from './types';

/** What a quote export renders: the live quote or an issued snapshot. */
export interface QuoteDocument {
  lines: QuoteLine[];
  settings: QuoteSettings;
  totals: QuoteTotals;
}

export interface PriceContext {
  /** The project's items (their copies win over the built-ins). */
  catalog: CatalogLookup;
  /** The project's cable prices, keyed by the BOM line key. */
  cablePrices: CablePrices;
}

export interface ResolvedPrice {
  unitPrice: number | null;
  code?: string;
  source: 'item' | 'cable' | 'none';
}

/** The price of a BOM line from the project's own copies: an item's, or a cable line's. */
export function lookupPrice(line: BomLine, ctx: PriceContext): ResolvedPrice {
  if (line.cable) {
    const price = ctx.cablePrices[line.key];
    if (price) {
      return {
        unitPrice: price.unitPrice,
        ...(price.code ? { code: price.code } : {}),
        source: 'cable',
      };
    }
    return { unitPrice: null, source: 'none' };
  }
  const item = line.itemId === undefined ? undefined : ctx.catalog(line.itemId);
  if (item?.unitPrice !== undefined) {
    return { unitPrice: item.unitPrice, ...(item.code ? { code: item.code } : {}), source: 'item' };
  }
  return { unitPrice: null, ...(item?.code ? { code: item.code } : {}), source: 'none' };
}

export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/** Labor lines in cents: lump sums as typed, hourly lines as hours × rate. */
export function laborAmounts(settings: QuoteSettings): { description: string; amount: number }[] {
  return settings.laborLines.map((l) => ({
    description: l.description,
    amount: l.kind === 'lump' ? toCents(l.amount) : Math.round(l.hours * toCents(l.hourlyRate)),
  }));
}

export interface QuoteResult {
  lines: QuoteLine[];
  labor: { description: string; amount: number }[];
  totals: QuoteTotals;
}

export function computeQuote(
  bom: readonly BomLine[],
  ctx: PriceContext,
  settings: QuoteSettings,
  describe: (line: BomLine) => string,
): QuoteResult {
  const lines: QuoteLine[] = bom.map((line) => {
    const price = lookupPrice(line, ctx);
    return {
      key: line.key,
      description: describe(line),
      ...(price.code ? { code: price.code } : {}),
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: price.unitPrice,
      total: price.unitPrice === null ? null : Math.round(line.quantity * price.unitPrice),
    };
  });
  const materialsBeforeAdjustment = lines.reduce((sum, l) => sum + (l.total ?? 0), 0);
  const adjustment = percentOf(materialsBeforeAdjustment, settings.materialAdjustmentPercent);
  const materials = materialsBeforeAdjustment + adjustment;
  const labor = laborAmounts(settings);
  const laborTotal = labor.reduce((sum, l) => sum + l.amount, 0);
  const taxable = materials + laborTotal;
  const vat = percentOf(taxable, settings.vatPercent);
  return {
    lines,
    labor,
    totals: {
      materialsBeforeAdjustment,
      adjustment,
      materials,
      labor: laborTotal,
      taxable,
      vat,
      total: taxable + vat,
      unpricedCount: lines.filter((l) => l.unitPrice === null).length,
    },
  };
}

/** Freezes a numbered snapshot; later price or catalog edits never change it. */
export function issueQuote(
  bom: readonly BomLine[],
  ctx: PriceContext,
  settings: QuoteSettings,
  describe: (line: BomLine) => string,
  number: number,
  now: Date,
  language: string,
): IssuedQuote {
  const { lines, totals } = computeQuote(bom, ctx, settings, describe);
  return structuredClone({
    number,
    issuedAt: now.toISOString(),
    language,
    lines,
    settings,
    totals,
    status: 'issued',
    note: '',
  });
}
