import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useEditor, useEditorContext, useEditorServices } from '@/stores/editor/EditorContext';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ProjectBody } from '@/app/layouts/BottomPanel';
import { ProjectTitleBar } from '@/app/layouts/ProjectTitleBar';
import { StatusBar } from '@/app/layouts/StatusBar';
import { useProjectOpener } from '@/features/start/hooks/useProjectOpener';
import { UpdateFromCatalogDialog } from '@/features/app-settings/components/UpdateFromCatalogDialog';
import { useProjectTransfer } from '@/features/exports/hooks/useProjectTransfer';
import { useSaveProject } from '@/features/editor/hooks/useSaveProject';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Shared frame of the project pages: title bar, view content, bottom panel, status bar, dialogs. */
export function ProjectFrame() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
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

  const { exporting, exportPdf, exportJson, importJson, importJsonFromDialog } =
    useProjectTransfer();

  // The native menu's Export and Import JSON. Run from another page (Settings), the menu sent the
  // user here first and left the command in the location state. Import JSON uses a dialog of its
  // own: the page's file input opens only on a click in the page, which a menu command is not.
  const location = useLocation();
  const navigate = useNavigate();
  const { windowHost } = useEditorServices();
  const run = useRef<(command: string) => void>(() => undefined);
  useEffect(() => {
    run.current = (command) => {
      if (command === 'exportPdf') void exportPdf();
      else if (command === 'exportJson') exportJson();
      else if (command === 'importJson' && !store.getState().readOnly) void importJsonFromDialog();
    };
  });
  useEffect(() => windowHost.onMenuCommand(({ command }) => run.current(command)), [windowHost]);
  const fromMenu = (location.state as { command?: string } | null)?.command;
  useEffect(() => {
    if (!fromMenu) return;
    run.current(fromMenu);
    void navigate(location.pathname, { replace: true, state: null });
  }, [fromMenu, location.pathname, navigate]);

  const opener = useProjectOpener();

  return (
    <div data-density="compact" className="flex h-screen flex-col bg-panel text-text">
      <ProjectTitleBar
        exporting={exporting}
        onExportPdf={() => void exportPdf()}
        onExportJson={exportJson}
        onImportJson={() => importInput.current?.click()}
        onUpdateFromCatalog={() => setUpdating(true)}
        onCloseProject={opener.closeProject}
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

      {narrow ? (
        <Banner
          action={
            <Button variant="ghost" size="sm" onClick={() => setNarrow(false)}>
              {t('editor.dismissNotice')}
            </Button>
          }
        >
          {t('editor.narrowNotice')}
        </Banner>
      ) : null}
      {readOnly ? <Banner tone="warning">{t('editor.readOnly')}</Banner> : null}
      <ProjectBody>
        <Outlet />
      </ProjectBody>
      <StatusBar />
      {saver.dialog}
      {opener.dialog}
      {updating ? <UpdateFromCatalogDialog onClose={() => setUpdating(false)} /> : null}
    </div>
  );
}
