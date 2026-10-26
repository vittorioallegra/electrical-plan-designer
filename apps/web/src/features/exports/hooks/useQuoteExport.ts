import { useTranslation } from 'react-i18next';
import type { IssuedQuote } from '@epd/domain/types';
import { useEditor } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';
import { fileSafe } from '@/lib/download';
import { exportFilters, useExportFile } from '@/hooks/useExportFile';
import type { Locale } from '@/lib/format';
import { blobToImage, type ImageData } from '@/features/exports/utils/pdfKit';
import { buildQuotePdf } from '@/features/exports/utils/quotePdf';
import type { QuoteDocument } from '@epd/domain/quote';
import { quoteCsv } from '@/features/exports/utils/quoteCsv';

const localeOf = (language: string): Locale => (language === 'it' ? 'it' : 'en');

/** Saves the live quote (current language) or an issued one (its own language). */
export function useQuoteExport() {
  const { i18n } = useTranslation();
  const company = useLibrary((s) => s.library.company);
  const libraryLogo = useLibrary((s) => s.logo);
  const exportFile = useExportFile();
  const meta = useEditor((s) => s.data.meta);

  function target(quote: QuoteDocument | IssuedQuote) {
    const issued = 'number' in quote ? quote : null;
    const language = issued?.language ?? i18n.language;
    return {
      t: i18n.getFixedT(language),
      locale: localeOf(language),
      base: `${fileSafe(meta.name)}-quote${issued ? `-${issued.number}` : ''}`,
    };
  }

  return {
    async csv(quote: QuoteDocument | IssuedQuote) {
      const { t, locale, base } = target(quote);
      await exportFile(
        `${base}.csv`,
        new Blob([quoteCsv(quote, t, locale)], { type: 'text/csv;charset=utf-8' }),
        exportFilters.csv,
      );
    },
    /** Throws when the PDF cannot be built; a logo that cannot be read is skipped. */
    async pdf(quote: QuoteDocument | IssuedQuote) {
      const { t, locale, base } = target(quote);
      let logo: ImageData | undefined;
      if (libraryLogo) {
        const blob = new Blob([libraryLogo.bytes as Uint8Array<ArrayBuffer>], {
          type: libraryLogo.mimeType,
        });
        logo = await blobToImage(blob).catch(() => undefined);
      }
      const pdf = buildQuotePdf({
        quote,
        company,
        ...(logo ? { logo } : {}),
        meta,
        t,
        locale,
        now: new Date(),
      });
      await exportFile(
        `${base}.pdf`,
        new Blob([pdf.bytes()], { type: 'application/pdf' }),
        exportFilters.pdf,
      );
    },
  };
}
