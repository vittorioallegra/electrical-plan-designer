import { useTranslation } from 'react-i18next';
import type { RouteResult } from '@epd/domain/routing';

/** Short routing outcome of a circuit or extra run. */
export function RouteStatus({ route }: { route: RouteResult | undefined }) {
  const { t } = useTranslation();
  if (!route) return null;
  if (!route.ok) {
    return (
      <span className="rounded bg-error-bg px-1 text-error">
        {t(`circuits.problems.${route.problem}`)}
      </span>
    );
  }
  if (route.unreachableTargetIds.length > 0) {
    return (
      <span className="rounded bg-warning-bg px-1 text-warning">
        {t('circuits.unreachable', { count: route.unreachableTargetIds.length })}
      </span>
    );
  }
  return (
    <span className="text-text-muted">
      {t('circuits.routed', { count: route.segmentIds.length })}
    </span>
  );
}
