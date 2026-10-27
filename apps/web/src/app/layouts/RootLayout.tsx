import { useTranslation } from 'react-i18next';
import { Outlet, useNavigation } from 'react-router';
import { MenuCommands } from '@/app/MenuCommands';

/**
 * Root of every route. A navigation waits for its loaders and lazy modules (e.g. opening a
 * project) while the previous page stays on screen, so a notice shows that it is loading.
 * The library notices sit in each frame under its title bar (on macOS the top of the window is
 * the title bar, with the traffic lights over it).
 */
export function RootLayout() {
  return (
    <>
      <NavigationPending />
      <MenuCommands />
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
      className="navigation-pending fixed top-2 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-raised px-3 py-1 text-small text-text-muted shadow-pop"
    >
      {t('common.loading')}
    </p>
  );
}
