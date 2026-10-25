import { Download, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { loadDoc } from '@/domain/load';
import { useEditor, useEditorContext, useEditorServices } from '@/state/EditorContext';
import type { DrawerTab } from '@/state/editorStore';
import type { UnsavedCopy } from '@/state/unsavedStore';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { downloadJson, fileSafe } from '@/ui/download';
import { Menu } from '@/ui/Menu';
import { Tabs } from '@/ui/Tabs';
import { cn } from '@/ui/cn';
import { useToast } from '@/ui/Toast';
import { LanguageSwitch } from '../shell/LanguageSwitch';
import { BomTab } from '../bom/BomTab';
import { WarningsBadge, WarningsTab } from '../checks/WarningsTab';
import { useProjectPdfExport } from '../exports/useProjectPdfExport';
import { CircuitsTab } from '../circuits/CircuitsTab';
import { ProgressStrip } from './ProgressStrip';
import { SaveStatus } from './SaveStatus';

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
export function ProjectFrame({
  restore,
  onRestoreHandled,
}: {
  restore: UnsavedCopy | null;
  onRestoreHandled: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const { unsaved } = useEditorServices();
  const toast = useToast();
  const navigate = useNavigate();
  const meta = useEditor((s) => s.meta);
  const readOnly = useEditor((s) => s.readOnly);
  const canUndo = useEditor((s) => s.past.length > 0 && !s.readOnly);
  const canRedo = useEditor((s) => s.future.length > 0 && !s.readOnly);
  const conflict = useEditor((s) => s.saveStatus === 'conflict');
  const importInput = useRef<HTMLInputElement>(null);
  const [conflictOpen, setConflictOpen] = useState(true);
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

  const exportJson = () =>
    downloadJson(store.getState().data.doc, `${fileSafe(store.getState().meta.name)}.json`);

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
        <NavLink to="/projects" className="text-text-muted hover:text-text">
          {t('nav.projects')}
        </NavLink>
        <span className="font-semibold" data-testid="project-name">
          {meta.name}
        </span>
        <SaveStatus />
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
          <span>{t('mobile.tabletNotice')}</span>
          <Button variant="ghost" onClick={() => setNarrow(false)}>
            {t('mobile.dismiss')}
          </Button>
        </div>
      ) : null}
      {readOnly ? (
        <p className="bg-warning-bg px-3 py-1.5 text-warning" role="status">
          {t('editor.readOnly')}
        </p>
      ) : null}
      {restore ? (
        <div className="flex items-center gap-3 bg-warning-bg px-3 py-1.5" role="status">
          <span>
            {t('editor.restore.body', {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(restore.savedAt)),
            })}
          </span>
          <Button
            variant="primary"
            onClick={() => {
              store.getState().applyCommand('restore', (d) => {
                d.doc = restore.data.doc;
                d.settings = restore.data.settings;
                d.quote = restore.data.quote;
              });
              onRestoreHandled();
            }}
          >
            {t('editor.restore.restore')}
          </Button>
          <Button
            onClick={() => {
              void unsaved.delete(restore.projectId);
              onRestoreHandled();
            }}
          >
            {t('editor.restore.discard')}
          </Button>
        </div>
      ) : null}

      <ProgressStrip />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <BottomDrawer />

      <Dialog
        open={conflict && conflictOpen}
        onOpenChange={setConflictOpen}
        title={t('editor.conflict.title')}
        description={t('editor.conflict.body')}
        footer={
          <>
            <Button onClick={exportJson}>{t('editor.conflict.download')}</Button>
            <Button variant="primary" onClick={() => navigate(0)}>
              {t('editor.conflict.reload')}
            </Button>
          </>
        }
      />
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
