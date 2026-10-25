import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/data';
import { formatQuoteNumber } from '@/domain/quote';
import type { IssuedQuote } from '@/domain/types';
import { useEditor } from '@/state/EditorContext';
import { downloadBlob, fileSafe } from '@/ui/download';
import type { Locale } from '@/ui/format';
import { useCatalog } from '../catalog/useCatalog';
import { blobToImage, type ImageData } from './pdfKit';
import { buildQuotePdf } from './quotePdf';
import { quoteCsv, type QuoteDocument } from './quoteCsv';

const localeOf = (language: string): Locale => (language === 'it' ? 'it' : 'en');

/** Downloads the live quote (current language) or an issued one (its own language). */
export function useQuoteExport() {
  const { i18n } = useTranslation();
  const { files } = useRepositories();
  const { profile } = useCatalog();
  const meta = useEditor((s) => s.meta);

  function target(quote: QuoteDocument | IssuedQuote) {
    const issued = 'number' in quote ? quote : null;
    const language = issued?.language ?? i18n.language;
    return {
      t: i18n.getFixedT(language),
      locale: localeOf(language),
      base: `${fileSafe(meta.name)}-quote${issued ? `-${formatQuoteNumber(issued)}` : ''}`,
    };
  }

  return {
    csv(quote: QuoteDocument | IssuedQuote) {
      const { t, locale, base } = target(quote);
      downloadBlob(
        new Blob([quoteCsv(quote, t, locale)], { type: 'text/csv;charset=utf-8' }),
        `${base}.csv`,
      );
    },
    /** Throws when the PDF cannot be built; a missing logo is skipped. */
    async pdf(quote: QuoteDocument | IssuedQuote) {
      const { t, locale, base } = target(quote);
      let logo: ImageData | undefined;
      if (profile?.logoPath) {
        logo = await files
          .download('logos', profile.logoPath)
          .then(blobToImage)
          .catch(() => undefined);
      }
      const pdf = buildQuotePdf({
        quote,
        profile: profile ?? { businessName: '', vatNumber: '', address: '', phone: '', email: '' },
        ...(logo ? { logo } : {}),
        meta,
        t,
        locale,
        now: new Date(),
      });
      downloadBlob(new Blob([pdf.bytes()], { type: 'application/pdf' }), `${base}.pdf`);
    },
  };
}
