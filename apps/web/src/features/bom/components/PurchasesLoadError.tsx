import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { Purchases } from '@/features/bom/hooks/usePurchases';

/** Shown instead of purchase state when the marks could not be loaded. */
export function PurchasesLoadError({ purchases }: { purchases: Purchases }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex items-center gap-2 rounded bg-error-bg px-2 py-1 text-error">
      <span className="flex-1">{t('purchases.loadFailed')}</span>
      <Button variant="secondary" onClick={purchases.retry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
