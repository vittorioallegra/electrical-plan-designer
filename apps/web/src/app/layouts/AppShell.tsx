import { LogOut, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useRepositories } from '@/lib/repositories/provider';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { setViewMode } from '@/lib/viewMode';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

export function AppShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  const repos = useRepositories();
  const navigate = useNavigate();
  return (
    <div data-density="compact" className="min-h-screen bg-surface text-text">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2">
        <span className="font-semibold">{t('app.name')}</span>
        {auth.status === 'signedIn' ? (
          <nav className="flex gap-3">
            <NavLink to="/" end>
              {t('nav.start')}
            </NavLink>
            <NavLink to="/projects">{t('nav.projects')}</NavLink>
            <NavLink to="/catalog">{t('nav.catalog')}</NavLink>
            <NavLink to="/profile">{t('nav.profile')}</NavLink>
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {auth.status === 'signedIn' ? (
            <Button
              variant="ghost"
              onClick={() => {
                setViewMode('mobile');
                void navigate('/m/projects');
              }}
            >
              <Smartphone size={16} />
              {t('mobile.mobileView')}
            </Button>
          ) : null}
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
