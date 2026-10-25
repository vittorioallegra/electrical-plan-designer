import { useTranslation } from 'react-i18next';
import { formatQuoteNumber } from '@/domain/quote';
import type { IssuedQuote } from '@/domain/types';
import { useEditor } from '@/state/EditorContext';
import { downloadBlob, fileSafe } from '@/ui/download';
import type { Locale } from '@/ui/format';
import { quoteCsv, type QuoteDocument } from './quoteCsv';

const localeOf = (language: string): Locale => (language === 'it' ? 'it' : 'en');

/** Downloads the live quote (current language) or an issued one (its own language). */
export function useQuoteExport() {
  const { i18n } = useTranslation();
  const name = useEditor((s) => s.meta.name);
  return {
    csv(quote: QuoteDocument | IssuedQuote) {
      const issued = 'number' in quote ? quote : null;
      const language = issued?.language ?? i18n.language;
      const csv = quoteCsv(quote, i18n.getFixedT(language), localeOf(language));
      const suffix = issued ? `-${formatQuoteNumber(issued)}` : '';
      downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `${fileSafe(name)}-quote${suffix}.csv`,
      );
    },
  };
}
