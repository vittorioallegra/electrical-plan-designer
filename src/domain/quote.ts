// Quote math in integer cents. Material lines come from the BOM; labor is typed by hand.
import type { BomLine } from './bom';
import type { CatalogLookup } from './catalog/lookup';
import type { CatalogItem } from './catalog/types';
import type { IssuedQuote, PriceOverrides, QuoteLine, QuoteSettings, QuoteTotals } from './types';

export interface PriceContext {
  catalog: CatalogLookup;
  /** The account's user items; priced cable items match cable lines by section + color. */
  userItems: readonly CatalogItem[];
  overrides: PriceOverrides;
}

export interface ResolvedPrice {
  unitPrice: number | null;
  code?: string;
  source: 'item' | 'override' | 'none';
}

/** Lookup order: user item price → account override → unpriced. */
export function lookupPrice(line: BomLine, ctx: PriceContext): ResolvedPrice {
  let item: CatalogItem | undefined;
  if (line.itemId !== undefined) {
    item = ctx.catalog(line.itemId);
  } else if (line.cable) {
    const { crossSection, color } = line.cable;
    item = ctx.userItems.find(
      (i) =>
        i.category === 'cable' &&
        !i.archived &&
        i.unitPrice !== undefined &&
        i.attributes.crossSection === crossSection &&
        i.attributes.color === color,
    );
  }
  if (item && item.ownerId !== null && item.unitPrice !== undefined) {
    return { unitPrice: item.unitPrice, ...(item.code ? { code: item.code } : {}), source: 'item' };
  }
  const override = ctx.overrides[line.key];
  if (override) {
    const code = override.code ?? item?.code;
    return { unitPrice: override.unitPrice, ...(code ? { code } : {}), source: 'override' };
  }
  return { unitPrice: null, ...(item?.code ? { code: item.code } : {}), source: 'none' };
}

export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
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
  const labor = settings.laborLines.map((l) => ({
    description: l.description,
    amount: l.kind === 'lump' ? toCents(l.amount) : Math.round(l.hours * toCents(l.hourlyRate)),
  }));
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
  });
}

/** "2026-007": issue year + per-account counter. */
export function formatQuoteNumber(quote: Pick<IssuedQuote, 'number' | 'issuedAt'>): string {
  return `${quote.issuedAt.slice(0, 4)}-${String(quote.number).padStart(3, '0')}`;
}
