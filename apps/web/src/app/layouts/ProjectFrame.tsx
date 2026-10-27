import { Download, Library, Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useEditor, useEditorContext, useEditorServices } from '@/stores/editor/EditorContext';
import type { DrawerTab } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/cn';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { BomTab } from '@/features/bom/components/BomTab';
import { WarningsBadge, WarningsTab } from '@/features/checks/components/WarningsTab';
import { UpdateFromCatalogDialog } from '@/features/app-settings/components/UpdateFromCatalogDialog';
import { useProjectTransfer } from '@/features/exports/hooks/useProjectTransfer';
import { CircuitsTab } from '@/features/circuits/components/CircuitsTab';
import { ProgressStrip } from '@/features/editor/components/ProgressStrip';
import { SaveStatus } from '@/features/editor/components/SaveStatus';
import { useSaveProject } from '@/features/editor/hooks/useSaveProject';

const viewTabs = [
  { to: 'plan', key: 'nav.plan' },
  { to: 'panel', key: 'nav.panel' },
  { to: 'quote', key: 'nav.quote' },
  { to: 'details', key: 'nav.project' },
] as const;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Shared frame of the project pages: top bar, view content, bottom drawer, dialogs. */
export function ProjectFrame() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const meta = useEditor((s) => s.data.meta);
  const readOnly = useEditor((s) => s.readOnly);
  const canUndo = useEditor((s) => s.past.length > 0 && !s.readOnly);
  const canRedo = useEditor((s) => s.future.length > 0 && !s.readOnly);
  const importInput = useRef<HTMLInputElement>(null);
  const [updating, setUpdating] = useState(false);
  // 768–1023 px gets the editor with a non-blocking notice, checked once on open.
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || isTyping(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) store.getState().redo();
      else store.getState().undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const saver = useSaveProject(store);
  const { save } = saver;
  // Ctrl+S saves the project, also while typing in a field.
  // A promise nobody awaits: save() reports its own failures.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      void save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const { exporting, exportPdf, exportJson, importJson } = useProjectTransfer();

  // The native menu's Export and Import JSON. Run from another page (Settings), the menu sent the
  // user here first and left the command in the location state.
  const location = useLocation();
  const navigate = useNavigate();
  const { windowHost } = useEditorServices();
  const run = useRef<(command: string) => void>(() => undefined);
  useEffect(() => {
    run.current = (command) => {
      if (command === 'exportPdf') void exportPdf();
      else if (command === 'exportJson') exportJson();
      else if (command === 'importJson' && !store.getState().readOnly) importInput.current?.click();
    };
  });
  useEffect(() => windowHost.onMenuCommand(({ command }) => run.current(command)), [windowHost]);
  const fromMenu = (location.state as { command?: string } | null)?.command;
  useEffect(() => {
    if (!fromMenu) return;
    run.current(fromMenu);
    void navigate(location.pathname, { replace: true, state: null });
  }, [fromMenu, location.pathname, navigate]);

  return (
    <div data-density="compact" className="flex h-screen flex-col bg-surface text-text">
      <header className="flex items-center gap-3 border-b border-border px-3 py-1.5">
        <NavLink to="/" className="text-text-muted hover:text-text">
          {t('nav.start')}
        </NavLink>
        <span className="font-semibold" data-testid="project-name">
          {meta.name}
        </span>
        <SaveStatus />
        <Button
          variant="secondary"
          disabled={readOnly || saver.saving}
          title={t('editor.saveHint')}
          onClick={() => void save()}
        >
          <Save size={16} />
          {t('editor.save')}
        </Button>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            aria-label={t('editor.undo')}
            disabled={!canUndo}
            onClick={() => store.getState().undo()}
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost"
            aria-label={t('editor.redo')}
            disabled={!canRedo}
            onClick={() => store.getState().redo()}
          >
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
        <Button
          variant="ghost"
          disabled={readOnly}
          title={t('library.update.title')}
          onClick={() => setUpdating(true)}
        >
          <Library size={16} />
          {t('library.update.open')}
        </Button>
        <NavLink to="/settings/company" className="text-text-muted hover:text-text">
          {t('library.open')}
        </NavLink>
        <Menu
          trigger={
            <Button variant="secondary">
              <Download size={16} />
              {t('editor.export')}
            </Button>
          }
          items={[
            {
              key: 'pdf',
              label: t('editor.exportPdf'),
              disabled: exporting,
              onSelect: () => void exportPdf(),
            },
            { key: 'json', label: t('editor.exportJson'), onSelect: exportJson },
            {
              key: 'import',
              label: t('editor.importJson'),
              disabled: readOnly,
              onSelect: () => importInput.current?.click(),
            },
          ]}
        />
        <input
          ref={importInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importJson(file);
          }}
        />
        <LanguageSwitch />
      </header>

      {narrow ? (
        <div className="flex items-center gap-3 bg-surface-muted px-3 py-1.5" role="status">
          <span>{t('editor.narrowNotice')}</span>
          <Button variant="ghost" onClick={() => setNarrow(false)}>
            {t('editor.dismissNotice')}
          </Button>
        </div>
      ) : null}
      {readOnly ? (
        <p className="bg-warning-bg px-3 py-1.5 text-warning" role="status">
          {t('editor.readOnly')}
        </p>
      ) : null}
      <ProgressStrip />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <BottomDrawer />
      {saver.dialog}
      {updating ? <UpdateFromCatalogDialog onClose={() => setUpdating(false)} /> : null}
    </div>
  );
}

function BottomDrawer() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const tab = useEditor((s) => s.ui.drawerTab);
  return (
    <section
      className="h-56 overflow-y-auto border-t border-border px-3"
      aria-label={t('editor.drawer')}
    >
      <Tabs
        value={tab}
        onValueChange={(value) => store.getState().setUi({ drawerTab: value as DrawerTab })}
        tabs={[
          {
            value: 'circuits',
            label: t('editor.tabs.circuits'),
            content: <CircuitsTab />,
          },
          {
            value: 'bom',
            label: t('editor.tabs.bom'),
            content: <BomTab />,
          },
          {
            value: 'warnings',
            label: (
              <>
                {t('editor.tabs.warnings')}
                <WarningsBadge />
              </>
            ),
            content: <WarningsTab />,
          },
        ]}
      />
    </section>
  );
}
