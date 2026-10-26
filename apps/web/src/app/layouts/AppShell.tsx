import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

/** Frame of the pages outside a project (the start screen). */
export function AppShell() {
  const { t } = useTranslation();
  return (
    <div data-density="compact" className="min-h-screen bg-surface text-text">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2">
        <Link to="/" className="font-semibold">
          {t('app.name')}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitch />
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
