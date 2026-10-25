import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { LanguageSwitch } from './LanguageSwitch';

export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="flex items-center gap-4 border-b border-neutral-200 px-4 py-2">
        <span className="font-semibold">{t('app.name')}</span>
        <nav className="flex gap-3 text-sm">
          <NavLink to="/projects">{t('nav.projects')}</NavLink>
          <NavLink to="/catalog">{t('nav.catalog')}</NavLink>
          <NavLink to="/profile">{t('nav.profile')}</NavLink>
        </nav>
        <div className="ml-auto">
          <LanguageSwitch />
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
