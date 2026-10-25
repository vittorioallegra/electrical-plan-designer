import { describe, expect, it } from 'vitest';
import { createI18n } from '@/lib/i18n';
import type { QuoteDocument } from '@epd/domain/quote';
import { quoteCsv } from './quoteCsv';

const quote: QuoteDocument = {
  lines: [
    {
      key: 'cable:2.5:brown',
      description: 'Cable H07V-K 2.5 mm² brown',
      code: 'H07-25-BR',
      quantity: 52,
      unit: 'm',
      unitPrice: 45,
      total: 2340,
    },
    {
      key: 'builtin:box_503',
      description: 'Wall box 503; "deep"',
      quantity: 4,
      unit: 'pcs',
      unitPrice: null,
      total: null,
    },
  ],
  settings: {
    materialAdjustmentPercent: 10,
    vatPercent: 22,
    laborLines: [
      { kind: 'lump', description: 'Panel wiring', amount: 150 },
      { kind: 'hourly', description: 'Chasing', hours: 2.5, hourlyRate: 30 },
    ],
  },
  totals: {
    materialsBeforeAdjustment: 2340,
    adjustment: 234,
    materials: 2574,
    labor: 22500,
    taxable: 25074,
    vat: 5516,
    total: 30590,
    unpricedCount: 1,
  },
};

describe('quote CSV', () => {
  // protects=AC 15 CSV for Excel in English; fails_when=separator, BOM, decimals, quoting or columns change; no_claim=quote math (domain tests)
  it('renders an English CSV', () => {
    const csv = quoteCsv(quote, createI18n('en').t, 'en');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toMatchSnapshot();
  });

  // protects=AC 15 CSV with Italian decimals; fails_when=decimals are not commas or labels are not translated; no_claim=—
  it('renders an Italian CSV with comma decimals', () => {
    const csv = quoteCsv(quote, createI18n('it').t, 'it');
    expect(csv).toContain(';0,45;23,40;');
    expect(csv).toMatchSnapshot();
  });
});
