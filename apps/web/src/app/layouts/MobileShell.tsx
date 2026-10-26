import { Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { setViewMode } from '@/lib/viewMode';

/** Phone layout: touch-sized controls, high contrast, no editing. */
export function MobileShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div data-density="touch" className="min-h-screen bg-surface text-base text-text">
      <header className="flex items-center gap-2 border-b-2 border-text px-3 py-2">
        <Link to="/m/projects" className="font-semibold">
          {t('app.name')}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitch />
          <Button
            variant="ghost"
            aria-label={t('mobile.desktopView')}
            onClick={() => {
              setViewMode('desktop');
              void navigate('/');
            }}
          >
            <Monitor size={18} />
          </Button>
        </div>
      </header>
      <main className="p-3">
        <Outlet />
      </main>
    </div>
  );
}
