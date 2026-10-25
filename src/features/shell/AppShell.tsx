import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { useRepositories } from '@/data';
import { Button } from '@/ui/Button';
import { useAuth } from '../auth/AuthProvider';
import { LanguageSwitch } from './LanguageSwitch';

export function AppShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  const repos = useRepositories();
  return (
    <div data-density="compact" className="min-h-screen bg-surface text-text">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2">
        <span className="font-semibold">{t('app.name')}</span>
        {auth.status === 'signedIn' ? (
          <nav className="flex gap-3">
            <NavLink to="/projects">{t('nav.projects')}</NavLink>
            <NavLink to="/catalog">{t('nav.catalog')}</NavLink>
            <NavLink to="/profile">{t('nav.profile')}</NavLink>
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitch />
          {auth.status === 'signedIn' ? (
            <>
              <span className="hidden text-text-muted sm:inline" data-testid="user-email">
                {auth.session.email}
              </span>
              <Button variant="ghost" onClick={() => void repos.auth.signOut()}>
                <LogOut size={16} />
                {t('auth.logOut')}
              </Button>
            </>
          ) : null}
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
