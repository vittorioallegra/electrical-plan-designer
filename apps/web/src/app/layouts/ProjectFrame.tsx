import { Download, Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { loadDoc } from '@epd/domain/load';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import type { DrawerTab } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { fileSafe } from '@/lib/download';
import { exportFilters, useExportFile } from '@/hooks/useExportFile';
import { Menu } from '@/components/ui/Menu';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/Toast';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { BomTab } from '@/features/bom/components/BomTab';
import { WarningsBadge, WarningsTab } from '@/features/checks/components/WarningsTab';
import { useProjectPdfExport } from '@/features/exports/hooks/useProjectPdfExport';
import { CircuitsTab } from '@/features/circuits/components/CircuitsTab';
import { ProgressStrip } from '@/features/editor/components/ProgressStrip';
import { SaveStatus } from '@/features/editor/components/SaveStatus';
import { useSaveProject } from '@/features/editor/hooks/useSaveProject';

const viewTabs = [
  { to: 'plan', key: 'nav.plan' },
  { to: 'panel', key: 'nav.panel' },
  { to: 'quote', key: 'nav.quote' },
  { to: 'settings', key: 'nav.settings' },
] as const;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Shared frame of the project pages: top bar, view content, bottom drawer, dialogs. */
export function ProjectFrame() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const toast = useToast();
  const meta = useEditor((s) => s.data.meta);
  const readOnly = useEditor((s) => s.readOnly);
  const canUndo = useEditor((s) => s.past.length > 0 && !s.readOnly);
  const canRedo = useEditor((s) => s.future.length > 0 && !s.readOnly);
  const importInput = useRef<HTMLInputElement>(null);
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

  const projectPdf = useProjectPdfExport();
  const [exporting, setExporting] = useState(false);
  async function exportPdf() {
    setExporting(true);
    try {
      await projectPdf();
    } catch {
      toast(t('editor.exportPdfFailed'), 'error');
    } finally {
      setExporting(false);
    }
  }

  const exportFile = useExportFile();
  const exportJson = () =>
    void exportFile(
      `${fileSafe(store.getState().data.meta.name)}.json`,
      new Blob([JSON.stringify(store.getState().data.doc, null, 2)], { type: 'application/json' }),
      exportFilters.json,
    );

  async function importJson(file: File) {
    try {
      const { doc, readOnly: newer } = loadDoc(JSON.parse(await file.text()));
      if (newer) {
        // A newer app's doc would lose the fields this version does not know when saved.
        toast(t('editor.importNewer'), 'error');
        return;
      }
      const result = store.getState().applyCommand('import', (d) => {
        d.doc = doc;
      });
      if (!result.ok) throw new Error(result.reason);
      toast(t('editor.importDone'), 'success');
    } catch {
      toast(t('editor.importFailed'), 'error');
    }
  }

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
        <NavLink to="/library/company" className="text-text-muted hover:text-text">
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
