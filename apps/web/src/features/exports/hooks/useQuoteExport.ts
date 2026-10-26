import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/lib/repositories/provider';
import { formatQuoteNumber } from '@epd/domain/quote';
import type { IssuedQuote } from '@epd/domain/types';
import { useEditor } from '@/stores/editor/EditorContext';
import { downloadBlob, fileSafe } from '@/lib/download';
import type { Locale } from '@/lib/format';
import { useCatalog } from '@/api/catalog';
import { blobToImage, type ImageData } from '@/features/exports/utils/pdfKit';
import { buildQuotePdf } from '@/features/exports/utils/quotePdf';
import type { QuoteDocument } from '@epd/domain/quote';
import { quoteCsv } from '@/features/exports/utils/quoteCsv';

const localeOf = (language: string): Locale => (language === 'it' ? 'it' : 'en');

/** Downloads the live quote (current language) or an issued one (its own language). */
export function useQuoteExport() {
  const { i18n } = useTranslation();
  const { files } = useRepositories();
  const { profile } = useCatalog();
  const meta = useEditor((s) => s.data.meta);

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
