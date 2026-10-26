import { describe, expect, it } from 'vitest';
import { guessCsvMapping, itemsFromCsv, parseCsv, parsePrice } from './csv';

describe('CSV price lists', () => {
  // protects=CSV parsing; fails_when=semicolon or comma files, quoted cells, BOM or CRLF lines split wrong; no_claim=other encodings than UTF-8
  it('parses semicolon and comma files with quotes', () => {
    expect(parseCsv('\uFEFFcode;name;price\r\nA1;"Socket; white";"1.234,50"\r\n\r\n')).toEqual([
      ['code', 'name', 'price'],
      ['A1', 'Socket; white', '1.234,50'],
    ]);
    expect(parseCsv('code,name\nA1,"Say ""hi"""\nA2,Plate')).toEqual([
      ['code', 'name'],
      ['A1', 'Say "hi"'],
      ['A2', 'Plate'],
    ]);
  });

  // protects=prices in cents; fails_when=Italian or English number formats are read as the wrong amount; no_claim=prices with thousand separators but no decimals
  it('reads prices in Italian and English formats', () => {
    expect(parsePrice('€ 1.234,56')).toBe(123456);
    expect(parsePrice('1,234.56')).toBe(123456);
    expect(parsePrice('12,5')).toBe(1250);
    expect(parsePrice('0.125')).toBe(13);
    expect(parsePrice('n/a')).toBeUndefined();
  });

  // protects=column mapping; fails_when=header names in English or Italian are not recognized; no_claim=fuzzy matching
  it('guesses the mapping from the header', () => {
    expect(guessCsvMapping(['Codice', 'Descrizione', 'Prezzo', 'UM', 'Moduli'])).toEqual({
      code: 0,
      name: 1,
      price: 2,
      unit: 3,
      modules: 4,
    });
  });

  // protects=CSV to items; fails_when=defaults are not applied to rows without category or modules, units are wrong, or bad rows are imported instead of skipped; no_claim=technical attributes (price lists have none)
  it('maps rows to items with defaults and skips bad rows', () => {
    const rows = [
      ['D1', 'Socket', '5,20', '', '', '1'],
      ['C1', 'Cable 2.5', '0,80', 'mt', 'cable', ''],
      ['X', '', '1', '', '', ''],
      ['B', 'Box', 'abc', '', 'box', ''],
      ['', 'Plate', '', 'pz', 'plate', ''],
    ];
    const mapping = { code: 0, name: 1, price: 2, unit: 3, category: 4, modules: 5 };
    const { items, skipped } = itemsFromCsv(rows, mapping, { category: 'device', modules: 2 });
    expect(skipped).toEqual([2, 3]);
    expect(items).toEqual([
      {
        category: 'device',
        name: 'Socket',
        code: 'D1',
        unitPrice: 520,
        unit: 'pcs',
        modules: 1,
        attributes: {},
      },
      {
        category: 'cable',
        name: 'Cable 2.5',
        code: 'C1',
        unitPrice: 80,
        unit: 'm',
        modules: 2,
        attributes: {},
      },
      { category: 'plate', name: 'Plate', unit: 'pcs', modules: 2, attributes: {} },
    ]);
  });
});
