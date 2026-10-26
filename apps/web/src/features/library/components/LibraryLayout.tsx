import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';
import { useWorkspace } from '@/stores/editor/EditorContext';
import { LibraryTransfer } from './LibraryTransfer';

const tabs = [
  { to: 'company', key: 'nav.company' },
  { to: 'catalog', key: 'nav.catalog' },
  { to: 'presets', key: 'nav.presets' },
  { to: 'defaults', key: 'nav.defaults' },
] as const;

/**
 * Frame of the library pages. They sit beside the project routes, so an open project stays
 * open; a link goes back to it.
 */
export function LibraryLayout() {
  const { t } = useTranslation();
  const project = useWorkspace((s) => s.current);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {project ? (
          <Link to="/project/plan" className="text-text-muted hover:text-text">
            {t('library.backToProject', { name: project.store.getState().data.meta.name })}
          </Link>
        ) : (
          <Link to="/" className="text-text-muted hover:text-text">
            {t('library.backToStart')}
          </Link>
        )}
        <span className="font-semibold">{t('library.title')}</span>
        <nav className="flex gap-1" aria-label={t('library.sections')}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'rounded px-3 py-1',
                  isActive ? 'bg-surface-muted font-medium' : 'text-text-muted',
                )
              }
            >
              {t(tab.key)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex gap-2">
          <LibraryTransfer />
        </div>
      </div>
      <Outlet />
    </div>
  );
}
