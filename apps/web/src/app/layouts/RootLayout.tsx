import { useTranslation } from 'react-i18next';
import { Outlet, useNavigation } from 'react-router';

/**
 * Root of every route. A navigation waits for its loaders and lazy modules (e.g. opening a
 * project) while the previous page stays on screen, so a notice shows that it is loading.
 */
export function RootLayout() {
  return (
    <>
      <NavigationPending />
      <Outlet />
    </>
  );
}

function NavigationPending() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;
  return (
    <p
      role="status"
      className="navigation-pending fixed top-2 left-1/2 z-50 -translate-x-1/2 rounded border border-border bg-surface px-3 py-1 text-sm text-text-muted shadow"
    >
      {t('common.loading')}
    </p>
  );
}
