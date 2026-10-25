import { Redo2, Undo2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { Button } from '@/ui/Button';
import { Tabs } from '@/ui/Tabs';
import { cn } from '@/ui/cn';
import { LanguageSwitch } from '../shell/LanguageSwitch';

const viewTabs = [
  { to: 'plan', key: 'nav.plan' },
  { to: 'panel', key: 'nav.panel' },
  { to: 'quote', key: 'nav.quote' },
  { to: 'settings', key: 'nav.settings' },
] as const;

/** Shared frame of the project pages: top bar, view content, bottom drawer. */
export function ProjectLayout() {
  const { t } = useTranslation();
  return (
    <div data-density="compact" className="flex h-screen flex-col bg-surface text-text">
      <header className="flex items-center gap-3 border-b border-border px-3 py-1.5">
        <NavLink to="/projects" className="text-text-muted hover:text-text">
          {t('nav.projects')}
        </NavLink>
        <span className="font-semibold" data-testid="project-name">
          {t('editor.untitledProject')}
        </span>
        <span className="text-text-muted" data-testid="save-status">
          {t('editor.saveStatus.saved')}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" aria-label={t('editor.undo')} disabled>
            <Undo2 size={16} />
          </Button>
          <Button variant="ghost" aria-label={t('editor.redo')} disabled>
            <Redo2 size={16} />
          </Button>
        </div>
        <nav className="mx-auto flex gap-1" aria-label={t('editor.views')}>
          {viewTabs.map((tab) => (
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
        <Button variant="secondary" disabled>
          <Download size={16} />
          {t('editor.export')}
        </Button>
        <LanguageSwitch />
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <BottomDrawer />
    </div>
  );
}

function BottomDrawer() {
  const { t } = useTranslation();
  return (
    <section className="h-48 border-t border-border px-3" aria-label={t('editor.drawer')}>
      <Tabs
        tabs={[
          {
            value: 'circuits',
            label: t('editor.tabs.circuits'),
            content: <Empty text={t('editor.empty.circuits')} />,
          },
          {
            value: 'bom',
            label: t('editor.tabs.bom'),
            content: <Empty text={t('editor.empty.bom')} />,
          },
          {
            value: 'warnings',
            label: t('editor.tabs.warnings'),
            content: <Empty text={t('editor.empty.warnings')} />,
          },
        ]}
      />
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-text-muted">{text}</p>;
}
