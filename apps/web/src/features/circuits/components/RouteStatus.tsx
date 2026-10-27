import { useTranslation } from 'react-i18next';
import type { RouteResult } from '@epd/domain/routing';
import { Badge } from '@/components/ui/Badge';

/** Short routing outcome of a circuit or extra run. */
export function RouteStatus({ route }: { route: RouteResult | undefined }) {
  const { t } = useTranslation();
  if (!route) return null;
  if (!route.ok) {
    return <Badge tone="error">{t(`circuits.problems.${route.problem}`)}</Badge>;
  }
  if (route.unreachableTargetIds.length > 0) {
    return (
      <Badge tone="warning">
        {t('circuits.unreachable', { count: route.unreachableTargetIds.length })}
      </Badge>
    );
  }
  return (
    <span className="text-text-muted">
      {t('circuits.routed', { count: route.segmentIds.length })}
    </span>
  );
}
