import { useTranslation } from 'react-i18next';
import { nextQuoteNumber } from '@epd/domain/issuedQuotes';
import { issueQuote } from '@epd/domain/quote';
import { useToast } from '@/components/ui/Toast';
import { useLiveQuote, usePriceContext } from '@/features/quote/hooks/useQuote';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';

/** Issues the live quote under the project's next number; earlier pending quotes are superseded. */
export function useIssueQuote(): { issue: () => void } {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const toast = useToast();
  const settings = useEditor((s) => s.data.quote.settings);
  const { describe } = useLiveQuote();
  const { bom } = useAnalysis();
  const ctx = usePriceContext();

  function issue() {
    const number = nextQuoteNumber(store.getState().data.quote.issued);
    const snapshot = issueQuote(bom, ctx, settings, describe, number, new Date(), i18n.language);
    const result = store.getState().issueQuote(snapshot);
    if (result.ok) toast(t('quote.issuedToast', { number }), 'success');
    else toast(t('quote.issueFailed'), 'error');
  }

  return { issue };
}
