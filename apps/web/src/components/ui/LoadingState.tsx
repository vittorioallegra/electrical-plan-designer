import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/** Shown while a route or a lazy module loads: one muted line, announced politely. */
export function LoadingState({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p role="status" className={cn('p-6 text-text-muted', className)}>
      {t('common.loading')}
    </p>
  );
}
