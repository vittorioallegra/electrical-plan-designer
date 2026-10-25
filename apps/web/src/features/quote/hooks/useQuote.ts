import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { computeQuote, type PriceContext, type QuoteResult } from '@epd/domain/quote';
import { useEditor } from '@/stores/editor/EditorContext';
import type { Locale } from '@/lib/format';
import { describeBomLine } from '@/lib/describeBom';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useCatalog } from '@/features/catalog/hooks/useCatalog';

/** Prices of the signed-in account: user items, built-in catalog and price overrides. */
export function usePriceContext(): PriceContext {
  const { lookup, userItems, profile } = useCatalog();
  return useMemo(
    () => ({ catalog: lookup, userItems, overrides: profile?.priceOverrides ?? {} }),
    [lookup, userItems, profile],
  );
}

/** The live quote of the open project, recomputed on every document or price change. */
export function useLiveQuote(): {
  quote: QuoteResult;
  describe: Parameters<typeof computeQuote>[3];
} {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'it' ? 'it' : 'en';
  const { bom } = useAnalysis();
  const { lookup } = useCatalog();
  const ctx = usePriceContext();
  const settings = useEditor((s) => s.data.quote.settings);
  return useMemo(() => {
    const describe = (line: Parameters<typeof describeBomLine>[0]) =>
      describeBomLine(line, lookup, t, locale);
    return { quote: computeQuote(bom, ctx, settings, describe), describe };
  }, [bom, ctx, settings, lookup, t, locale]);
}
