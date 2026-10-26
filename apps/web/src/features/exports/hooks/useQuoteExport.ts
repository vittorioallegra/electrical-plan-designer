import { useTranslation } from 'react-i18next';
import type { IssuedQuote } from '@epd/domain/types';
import { useEditor } from '@/stores/editor/EditorContext';
import { downloadBlob, fileSafe } from '@/lib/download';
import { assetBlob } from '@/lib/projectFile/epd';
import type { Locale } from '@/lib/format';
import { useCatalog } from '@/hooks/useCatalog';
import { blobToImage, type ImageData } from '@/features/exports/utils/pdfKit';
import { buildQuotePdf } from '@/features/exports/utils/quotePdf';
import type { QuoteDocument } from '@epd/domain/quote';
import { quoteCsv } from '@/features/exports/utils/quoteCsv';

const localeOf = (language: string): Locale => (language === 'it' ? 'it' : 'en');

/** Downloads the live quote (current language) or an issued one (its own language). */
export function useQuoteExport() {
  const { i18n } = useTranslation();
  const { company } = useCatalog();
  const assets = useEditor((s) => s.assets);
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
      const logoAsset = company.logoAssetId ? assets.get(company.logoAssetId) : undefined;
      if (logoAsset) logo = await blobToImage(assetBlob(logoAsset)).catch(() => undefined);
      const pdf = buildQuotePdf({
        quote,
        company,
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
