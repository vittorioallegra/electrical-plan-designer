import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';
import { useWorkspace } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';
import { LibraryTransfer } from './LibraryTransfer';

const sections = [
  { to: 'general', key: 'nav.general' },
  { to: 'company', key: 'nav.company' },
  { to: 'catalog', key: 'nav.catalog' },
  { to: 'presets', key: 'nav.presets' },
  { to: 'new-projects', key: 'nav.newProjects' },
] as const;

const row = 'flex h-7 items-center gap-2 rounded-sm px-2 text-body';

/**
 * Frame of the Settings screen: a sidebar with the sections, the imported catalogs and the
 * import/export of the whole settings, and the section beside it. The sections sit beside the
 * project routes, so an open project stays open; a link goes back to it.
 */
export function SettingsLayout() {
  const { t } = useTranslation();
  const project = useWorkspace((s) => s.current);
  const catalogs = useLibrary((s) => s.library.catalogs);
  return (
    <div className="flex min-h-screen">
      <nav
        aria-label={t('appSettings.sections')}
        className="flex w-56 flex-none flex-col gap-0.5 border-r border-border bg-chrome px-2 py-3"
      >
        <Link
          to={project ? '/project/plan' : '/'}
          className={cn(row, 'mb-2 text-text-muted hover:bg-hover hover:text-text')}
        >
          <ChevronLeft size={14} aria-hidden />
          <span className="truncate">
            {project
              ? t('library.backToProject', { name: project.store.getState().data.meta.name })
              : t('library.backToStart')}
          </span>
        </Link>
        <div className="px-2 pb-1 text-label font-semibold tracking-wide text-text-muted uppercase">
          {t('appSettings.title')}
        </div>
        {sections.map((section) => (
          <div key={section.to} className="flex flex-col gap-0.5">
            <NavLink
              to={section.to}
              className={({ isActive }) =>
                cn(
                  row,
                  isActive
                    ? 'bg-accent-subtle font-medium text-accent-text'
                    : 'text-text hover:bg-hover',
                )
              }
            >
              {t(section.key)}
            </NavLink>
            {section.to === 'catalog' && catalogs.length > 0 ? (
              <ul aria-label={t('catalog.catalogs')} className="flex flex-col gap-0.5">
                {catalogs.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="catalog"
                      className={cn(row, 'pl-5 text-text-muted hover:bg-hover hover:text-text')}
                    >
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="font-mono text-small tabular-nums">{c.items.length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
          <LibraryTransfer />
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
