import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { CatalogProvider } from '@/api/catalog';
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
    <CatalogProvider>
      <Outlet />
    </CatalogProvider>
  );
}
