import { useTranslation } from 'react-i18next';
import type { QuoteResult } from '@epd/domain/quote';
import { formatMoney, type Locale } from '@/lib/format';

/** Materials, adjustment, labor, taxable, VAT and the grand total. */
export function QuoteTotals({ quote, locale }: { quote: QuoteResult; locale: Locale }) {
  const { t } = useTranslation();
  const { totals } = quote;
  const rows: [string, number][] = [
    ['quote.totals.materialsBeforeAdjustment', totals.materialsBeforeAdjustment],
    ['quote.totals.adjustment', totals.adjustment],
    ['quote.totals.materials', totals.materials],
    ['quote.totals.labor', totals.labor],
    ['quote.totals.taxable', totals.taxable],
    ['quote.totals.vat', totals.vat],
  ];
  return (
    <section
      aria-label={t('quote.totalsTitle')}
      className="flex flex-col gap-2"
      data-testid="quote-totals"
    >
      <h2 className="text-label font-semibold tracking-wide text-text-muted uppercase">
        {t('quote.totalsTitle')}
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono tabular-nums">
        {rows.map(([key, cents]) => (
          <div key={key} className="contents">
            <dt className="font-sans text-text-muted">{t(key)}</dt>
            <dd className="text-right">{formatMoney(cents, locale)}</dd>
          </div>
        ))}
        <dt className="mt-1 border-t border-border pt-2 font-sans font-semibold">
          {t('quote.totals.total')}
        </dt>
        <dd
          className="mt-1 border-t border-border pt-2 text-right text-heading font-semibold"
          data-testid="quote-total"
        >
          {formatMoney(totals.total, locale)}
        </dd>
      </dl>
    </section>
  );
}
