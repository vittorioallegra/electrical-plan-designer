// Quote CSV for Excel: `;` separator, UTF-8 with BOM, decimals in the quote's language.
import type { TFunction } from 'i18next';
import { laborAmounts } from '@epd/domain/quote';
import type { QuoteLine, QuoteSettings, QuoteTotals } from '@epd/domain/types';
import type { Locale } from '@/lib/format';

/** What a quote export renders: the live quote or an issued snapshot. */
export interface QuoteDocument {
  lines: QuoteLine[];
  settings: QuoteSettings;
  totals: QuoteTotals;
}

const BOM = '﻿';

function cell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Plain decimal (no grouping) with the locale separator, so Excel reads it as a number. */
function decimal(value: number, locale: Locale, digits: number): string {
  const text = value.toFixed(digits);
  return locale === 'it' ? text.replace('.', ',') : text;
}

export function quoteCsv(quote: QuoteDocument, t: TFunction, locale: Locale): string {
  const money = (cents: number | null) => (cents === null ? '' : decimal(cents / 100, locale, 2));
  const qty = (n: number) => decimal(n, locale, Number.isInteger(n) ? 0 : 2);
  const rows: string[][] = [
    [
      t('quote.code'),
      t('quote.description'),
      t('quote.quantity'),
      t('quote.unit'),
      t('quote.unitPrice'),
      t('quote.lineTotal'),
      t('quote.note'),
    ],
  ];
  for (const l of quote.lines) {
    rows.push([
      l.code ?? '',
      l.description,
      qty(l.quantity),
      t(`bom.units.${l.unit}`),
      money(l.unitPrice),
      money(l.total),
      l.unitPrice === null ? t('quote.noPrice') : '',
    ]);
  }
  for (const l of laborAmounts(quote.settings)) {
    rows.push(['', l.description, '', '', '', money(l.amount), t('quote.labor')]);
  }
  const { totals } = quote;
  rows.push([]);
  const total = (key: string, cents: number) =>
    rows.push(['', t(key), '', '', '', money(cents), '']);
  total('quote.totals.materialsBeforeAdjustment', totals.materialsBeforeAdjustment);
  total('quote.totals.adjustment', totals.adjustment);
  total('quote.totals.materials', totals.materials);
  total('quote.totals.labor', totals.labor);
  total('quote.totals.taxable', totals.taxable);
  rows.push([
    '',
    t('quote.vatRate', {
      percent: decimal(
        quote.settings.vatPercent,
        locale,
        Number.isInteger(quote.settings.vatPercent) ? 0 : 2,
      ),
    }),
    '',
    '',
    '',
    money(totals.vat),
    '',
  ]);
  total('quote.totals.total', totals.total);
  return BOM + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
