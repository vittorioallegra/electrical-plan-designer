// CSV price lists: parsing and mapping columns to catalog items. A price list carries no
// technical attributes; category and modules come from a column or from the import defaults.
import type { IncomingItem } from './replace';
import { catalogCategorySchema } from './schema';
import type { CatalogCategory } from './types';

/** Rows of a CSV text. Delimiter `;`, `,` or tab (taken from the first line); quotes as RFC 4180. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ','].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export const csvFields = ['code', 'name', 'price', 'unit', 'category', 'modules'] as const;
export type CsvField = (typeof csvFields)[number];

/** Column index per field; an absent field is not imported. */
export type CsvMapping = Partial<Record<CsvField, number>>;

export interface CsvDefaults {
  /** For rows without a (valid) category column. */
  category: CatalogCategory;
  /** For rows without a (valid) modules column. */
  modules?: number;
}

const HEADER_NAMES: Record<CsvField, string[]> = {
  code: ['code', 'codice', 'cod', 'articolo', 'article', 'sku', 'item'],
  name: ['name', 'description', 'descrizione', 'nome', 'desc'],
  price: ['price', 'prezzo', 'listino', 'unit price', 'prezzo unitario', 'list price'],
  unit: ['unit', 'um', 'u.m.', 'unità', 'unita', 'uom'],
  category: ['category', 'categoria'],
  modules: ['modules', 'moduli', 'mod'],
};

/** A first guess of the mapping from the header row (English or Italian names). */
export function guessCsvMapping(header: readonly string[]): CsvMapping {
  const mapping: CsvMapping = {};
  const normalized = header.map((h) => h.trim().toLowerCase());
  for (const field of csvFields) {
    const index = normalized.findIndex((h) => HEADER_NAMES[field].includes(h));
    if (index >= 0 && !Object.values(mapping).includes(index)) mapping[field] = index;
  }
  return mapping;
}

/**
 * A price in integer cents. With both `.` and `,` the last one is the decimal separator
 * (`1.234,56`, `1,234.56`); a lone `,` or `.` is decimal. Currency signs and spaces are ignored.
 */
export function parsePrice(text: string): number | undefined {
  let s = text.replace(/[€$£\s\u00a0]/g, '');
  if (s === '') return undefined;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    s = s
      .split(decimal === ',' ? '.' : ',')
      .join('')
      .replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  return Math.round(Number(s) * 100);
}

const METERS = new Set(['m', 'mt', 'ml', 'metri', 'metro', 'meter', 'meters', 'metre', 'metres']);

function parseCategory(text: string | undefined): CatalogCategory | undefined {
  const value = text
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const parsed = catalogCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseModules(text: string | undefined): number | undefined {
  const n = Number(text?.trim());
  return text?.trim() && Number.isInteger(n) && n > 0 ? n : undefined;
}

export interface CsvImport {
  items: IncomingItem[];
  /** Rows left out (0-based, header excluded): no name, or a price that is not a number. */
  skipped: number[];
}

/** Catalog items from data rows (header excluded). */
export function itemsFromCsv(
  rows: readonly (readonly string[])[],
  mapping: CsvMapping,
  defaults: CsvDefaults,
): CsvImport {
  const result: CsvImport = { items: [], skipped: [] };
  const cell = (row: readonly string[], field: CsvField) => {
    const index = mapping[field];
    return index === undefined ? undefined : row[index]?.trim();
  };
  rows.forEach((row, i) => {
    const name = cell(row, 'name');
    const priceText = cell(row, 'price');
    const unitPrice = priceText ? parsePrice(priceText) : undefined;
    if (!name || (priceText && unitPrice === undefined)) {
      result.skipped.push(i);
      return;
    }
    const category = parseCategory(cell(row, 'category')) ?? defaults.category;
    const unitText = cell(row, 'unit')?.toLowerCase();
    const unit = unitText
      ? METERS.has(unitText)
        ? 'm'
        : 'pcs'
      : category === 'cable' || category === 'conduit'
        ? 'm'
        : 'pcs';
    const code = cell(row, 'code');
    const modules = parseModules(cell(row, 'modules')) ?? defaults.modules;
    result.items.push({
      category,
      name,
      ...(code ? { code } : {}),
      ...(unitPrice === undefined ? {} : { unitPrice }),
      unit,
      ...(modules === undefined ? {} : { modules }),
      attributes: {},
    });
  });
  return result;
}
