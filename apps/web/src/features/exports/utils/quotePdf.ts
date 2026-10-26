// Quote PDF: business header, client, numbered lines, labor and totals.
import type { TFunction } from 'i18next';
import type { LibraryCompany } from '@epd/domain/library';
import { laborAmounts } from '@epd/domain/quote';
import type { IssuedQuote, ProjectMeta } from '@epd/domain/types';
import { formatMoney, formatNumber, type Locale } from '@/lib/format';
import { CONTENT_WIDTH, PAGE, PdfWriter, type ImageData } from './pdfKit';
import type { QuoteDocument } from '@epd/domain/quote';

export interface QuotePdfInput {
  quote: QuoteDocument | IssuedQuote;
  company: LibraryCompany;
  logo?: ImageData;
  meta: Pick<ProjectMeta, 'name' | 'clientName' | 'address'>;
  t: TFunction;
  locale: Locale;
  /** Date shown on a live (not issued) quote. */
  now: Date;
}

export function buildQuotePdf({ quote, company, logo, meta, t, locale, now }: QuotePdfInput) {
  const pdf = new PdfWriter();
  const money = (cents: number | null) => (cents === null ? '—' : formatMoney(cents, locale));
  const issued = 'number' in quote ? quote : null;
  const date = new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'long',
  }).format(issued ? new Date(issued.issuedAt) : now);

  // Business header: logo left, details right; empty fields are omitted.
  const top = pdf.y;
  let textX = PAGE.margin;
  let logoHeight = 0;
  if (logo) {
    const drawn = pdf.image(logo, PAGE.margin, top, 40, 25);
    textX += drawn.w + 6;
    logoHeight = drawn.h;
  }
  pdf.doc.setFont('helvetica', 'bold');
  pdf.doc.setFontSize(13);
  pdf.y = top + 5;
  if (company.businessName) pdf.doc.text(company.businessName, textX, pdf.y);
  pdf.doc.setFont('helvetica', 'normal');
  pdf.doc.setFontSize(9);
  pdf.y += 1;
  pdf.lines(
    [
      company.address,
      company.vatNumber ? t('pdf.vatNumber', { value: company.vatNumber }) : '',
      [company.phone, company.email].filter(Boolean).join(' · '),
    ],
    textX,
    PAGE.margin + CONTENT_WIDTH - textX,
  );
  pdf.doc.setFontSize(10);
  pdf.y = Math.max(pdf.y, top + logoHeight) + 8;

  pdf.heading(
    issued
      ? t('pdf.quoteTitle', { number: issued.number, project: meta.name })
      : t('pdf.quoteDraft'),
    16,
  );
  pdf.lines([
    t('pdf.date', { date }),
    issued ? t('pdf.status', { status: t(`quote.status.${issued.status}`) }) : '',
    t('pdf.client', { name: meta.clientName || '—' }),
    meta.address ? t('pdf.siteAddress', { address: meta.address }) : '',
    t('pdf.project', { name: meta.name }),
  ]);
  pdf.gap(6);

  pdf.table(
    [
      { header: t('quote.code'), width: 24 },
      { header: t('quote.description'), width: 70 },
      { header: t('quote.quantity'), width: 22, align: 'right' },
      { header: t('quote.unitPrice'), width: 32, align: 'right' },
      { header: t('quote.lineTotal'), width: CONTENT_WIDTH - 148, align: 'right' },
    ],
    quote.lines.map((l) => [
      l.code ?? '',
      l.unitPrice === null ? `${l.description} (${t('quote.noPrice')})` : l.description,
      `${formatNumber(l.quantity, locale)} ${t(`bom.units.${l.unit}`)}`,
      money(l.unitPrice),
      money(l.total),
    ]),
  );

  const labor = laborAmounts(quote.settings);
  if (labor.length > 0) {
    pdf.heading(t('quote.labor'), 11);
    pdf.table(
      [
        { header: t('quote.description'), width: CONTENT_WIDTH - 40 },
        { header: t('quote.amount'), width: 40, align: 'right' },
      ],
      labor.map((l) => [l.description, money(l.amount)]),
    );
  }

  const { totals, settings } = quote;
  pdf.summary([
    [t('quote.totals.materialsBeforeAdjustment'), money(totals.materialsBeforeAdjustment)],
    ...(totals.adjustment !== 0
      ? ([
          [
            t('pdf.adjustment', {
              percent: formatNumber(settings.materialAdjustmentPercent, locale),
            }),
            money(totals.adjustment),
          ],
        ] as [string, string][])
      : []),
    [t('quote.totals.labor'), money(totals.labor)],
    [t('quote.totals.taxable'), money(totals.taxable)],
    [t('quote.vatRate', { percent: formatNumber(settings.vatPercent, locale) }), money(totals.vat)],
    [t('quote.totals.total'), money(totals.total), true],
  ]);
  if (totals.unpricedCount > 0) {
    pdf.gap(4);
    pdf.lines([t('quote.unpriced', { count: totals.unpricedCount })]);
  }
  return pdf;
}
