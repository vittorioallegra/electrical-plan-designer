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
    <section aria-label={t('quote.totalsTitle')} data-testid="quote-totals">
      <h2 className="mb-1 font-medium">{t('quote.totalsTitle')}</h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
        {rows.map(([key, cents]) => (
          <div key={key} className="contents">
            <dt className="text-text-muted">{t(key)}</dt>
            <dd className="text-right">{formatMoney(cents, locale)}</dd>
          </div>
        ))}
        <dt className="border-t border-border pt-1 font-semibold">{t('quote.totals.total')}</dt>
        <dd
          className="border-t border-border pt-1 text-right font-semibold"
          data-testid="quote-total"
        >
          {formatMoney(totals.total, locale)}
        </dd>
      </dl>
    </section>
  );
}
