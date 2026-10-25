import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatQuoteNumber, issueQuote } from '@epd/domain/quote';
import { useNextQuoteNumber } from '@/api/profile';
import { useToast } from '@/components/ui/Toast';
import { useLiveQuote, usePriceContext } from '@/features/quote/hooks/useQuote';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';

/** Issues the live quote: reserves the next number and appends the snapshot to the project. */
export function useIssueQuote(): { issue: () => Promise<void>; issuing: boolean } {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const toast = useToast();
  const nextQuoteNumber = useNextQuoteNumber();
  const settings = useEditor((s) => s.data.quote.settings);
  const { describe } = useLiveQuote();
  const { bom } = useAnalysis();
  const ctx = usePriceContext();
  const [issuing, setIssuing] = useState(false);

  async function issue() {
    setIssuing(true);
    try {
      const number = await nextQuoteNumber.mutateAsync();
      const snapshot = issueQuote(bom, ctx, settings, describe, number, new Date(), i18n.language);
      store.getState().appendIssuedQuote(snapshot);
      toast(t('quote.issuedToast', { number: formatQuoteNumber(snapshot) }), 'success');
    } catch {
      toast(t('quote.issueFailed'), 'error');
    } finally {
      setIssuing(false);
    }
  }

  return { issue, issuing };
}
