import { FileSpreadsheet, FileText, Stamp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuoteDocument } from '@epd/domain/quote';
import type { IssuedQuote, QuoteSettings } from '@epd/domain/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useIssueQuote } from '@/features/quote/hooks/useIssueQuote';
import { useLiveQuote } from '@/features/quote/hooks/useQuote';
import type { Locale } from '@/lib/format';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { IssuedQuotes } from './IssuedQuotes';
import { LaborLines } from '@/components/quote/LaborLines';
import { QuoteMaterials } from './QuoteMaterials';
import { QuoteSettingsForm } from '@/components/quote/QuoteSettingsForm';
import { QuoteTotals } from './QuoteTotals';

/** Quote downloads, supplied by the app (built by the exports feature). */
export interface QuoteExporter {
  csv: (quote: QuoteDocument | IssuedQuote) => void;
  /** Throws when the PDF cannot be built. */
  pdf: (quote: QuoteDocument | IssuedQuote) => Promise<void>;
}

/** Quote settings, live totals, unpriced lines with inline prices, and issued snapshots. */
export function QuotePage({ exporter }: { exporter: QuoteExporter }) {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const toast = useToast();
  const readOnly = useEditor((s) => s.readOnly);
  const settings = useEditor((s) => s.data.quote.settings);
  const issued = useEditor((s) => s.data.quote.issued);
  const { quote } = useLiveQuote();
  const { issue } = useIssueQuote();

  const editSettings = (label: string, fn: (s: QuoteSettings) => void) =>
    store.getState().applyCommand(label, (d) => {
      fn(d.quote.settings);
    });

  async function exportPdf(q: QuoteDocument | IssuedQuote) {
    try {
      await exporter.pdf(q);
    } catch {
      toast(t('quote.exportFailed'), 'error');
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <h1 className="text-heading font-semibold">{t('pages.quote')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2" role="group" aria-label={t('quote.exportLive')}>
            <Button onClick={() => void exporter.csv({ ...quote, settings })}>
              <FileSpreadsheet size={16} />
              {t('quote.exportCsv')}
            </Button>
            <Button onClick={() => void exportPdf({ ...quote, settings })}>
              <FileText size={16} />
              {t('quote.exportPdf')}
            </Button>
          </div>
          <Button variant="primary" disabled={readOnly} onClick={issue}>
            <Stamp size={16} />
            {t('quote.issue')}
          </Button>
        </div>
      </header>
      {quote.totals.unpricedCount > 0 ? (
        <Banner tone="warning">{t('quote.unpriced', { count: quote.totals.unpricedCount })}</Banner>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_20rem]">
        <section aria-label={t('quote.materials')} className="min-w-0 px-6 py-4">
          <h2 className="mb-2 text-label font-semibold tracking-wide text-text-muted uppercase">
            {t('quote.materials')}
          </h2>
          <QuoteMaterials quote={quote} locale={locale} readOnly={readOnly} />
        </section>

        <div className="flex flex-col gap-6 border-t border-border px-6 py-4 lg:border-t-0 lg:border-l lg:px-4">
          <QuoteSettingsForm settings={settings} readOnly={readOnly} edit={editSettings} />
          <QuoteTotals quote={quote} locale={locale} />
        </div>
      </div>

      <div className="border-t border-border px-6 py-4">
        <LaborLines lines={settings.laborLines} readOnly={readOnly} edit={editSettings} />
      </div>

      <div className="border-t border-border px-6 py-4">
        <IssuedQuotes
          issued={issued}
          locale={locale}
          readOnly={readOnly}
          exportCsv={exporter.csv}
          exportPdf={exportPdf}
        />
      </div>
    </div>
  );
}
