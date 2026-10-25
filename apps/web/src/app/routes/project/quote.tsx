import { useQuoteExport } from '@/features/exports/hooks/useQuoteExport';
import { QuotePage } from '@/features/quote/components/QuotePage';

/** Quote page with the exports feature's CSV/PDF downloads. */
export function QuoteRoute() {
  const exporter = useQuoteExport();
  return <QuotePage exporter={exporter} />;
}
