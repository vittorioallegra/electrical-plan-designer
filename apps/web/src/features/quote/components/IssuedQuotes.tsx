import { FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatQuoteNumber } from '@epd/domain/quote';
import type { IssuedQuote } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
import { formatMoney, type Locale } from '@/lib/format';

/** Issued quote snapshots, newest first, each with its CSV and PDF downloads. */
export function IssuedQuotes({
  issued,
  locale,
  exportCsv,
  exportPdf,
}: {
  issued: IssuedQuote[];
  locale: Locale;
  exportCsv: (q: IssuedQuote) => void;
  exportPdf: (q: IssuedQuote) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const money = (cents: number) => formatMoney(cents, locale);
  return (
    <section aria-label={t('quote.issuedTitle')}>
      <h2 className="mb-1 font-medium">{t('quote.issuedTitle')}</h2>
      {issued.length === 0 ? (
        <p className="text-text-muted">{t('quote.noIssued')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {[...issued].reverse().map((q) => (
            <li key={q.number} className="flex flex-wrap items-center gap-x-4 py-1">
              <span className="font-medium tabular-nums">{formatQuoteNumber(q)}</span>
              <span className="text-text-muted">
                {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                  new Date(q.issuedAt),
                )}
              </span>
              <span className="tabular-nums">{money(q.totals.total)}</span>
              <Button
                variant="ghost"
                aria-label={`${t('quote.exportCsv')} ${formatQuoteNumber(q)}`}
                onClick={() => exportCsv(q)}
              >
                <FileSpreadsheet size={14} />
                {t('quote.exportCsv')}
              </Button>
              <Button
                variant="ghost"
                aria-label={`${t('quote.exportPdf')} ${formatQuoteNumber(q)}`}
                onClick={() => void exportPdf(q)}
              >
                <FileText size={14} />
                {t('quote.exportPdf')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
