import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { computeQuote, type PriceContext, type QuoteResult } from '@/domain/quote';
import { useEditor } from '@/state/EditorContext';
import type { Locale } from '@/ui/format';
import { describeBomLine } from '../bom/describe';
import { useAnalysis } from '../bom/useAnalysis';
import { useCatalog } from '../catalog/useCatalog';

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
