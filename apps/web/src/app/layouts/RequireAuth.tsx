import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useCatalogItems } from '@/api/catalog';
import { useProfile } from '@/api/profile';
import { useAuth } from '@/lib/auth/AuthProvider';

/**
 * Protected routes. On sign-out or session expiry, redirects to /login and comes back after.
 * When another user signs in (e.g. in another tab), the protected tree is replaced by the
 * project list: an open editor must not restart or save the previous user's project.
 */
export function RequireAuth() {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const userId = auth.session?.userId;
  // User the current pages were opened for and, after a user change, the location to leave
  // (state adjusted during render, so the old pages never render for the new user).
  const [pages, setPages] = useState<{ user: string | undefined; leave?: string }>({
    user: userId,
  });
  let current = pages;
  if (userId && userId !== pages.user) {
    current = { user: userId, ...(pages.user ? { leave: location.key } : {}) };
    setPages(current);
  }
  const userChanged = current.leave === location.key;
  if (auth.status === 'loading') {
    return <p className="p-4 text-text-muted">{t('common.loading')}</p>;
  }
  if (auth.status === 'signedOut') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (userChanged) {
    const list = location.pathname.startsWith('/m/') ? '/m/projects' : '/projects';
    return <Navigate to={list} replace />;
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
