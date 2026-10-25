import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useCatalogItems } from '@/api/catalog';
import { useProfile } from '@/api/profile';
import { useAuth } from '@/lib/auth/AuthProvider';

/** Protected routes. On sign-out or session expiry, redirects to /login and comes back after. */
export function RequireAuth() {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') {
    return <p className="p-4 text-text-muted">{t('common.loading')}</p>;
  }
  if (auth.status === 'signedOut') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return (
    <>
      <SharedData />
      <Outlet />
    </>
  );
}

/** Loads the catalog and profile once on entering the signed-in area and keeps them cached. */
function SharedData() {
  useCatalogItems();
  useProfile();
  return null;
}
