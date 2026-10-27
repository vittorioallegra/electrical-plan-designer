import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ProjectFileError } from '@epd/domain/projectFile';
import { queryKeys } from '@/api/keys';
import { readEpd, type OpenedProject } from '@/lib/projectFile/epd';
import { useEditorServices, useWorkspace } from '@/stores/editor/EditorContext';
import { saveStatusOf, type EditorInit } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

/**
 * What replaces the open project (the start screen's New and Open, the native menu, a file the OS
 * opens): every way in asks first when the project has changes that are not in a file, or when
 * a recovery copy with such changes would be left behind. Render `dialog` in the page.
 */
export function useProjectOpener() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { recovery, recent, fileAccess, workspace } = useEditorServices();
  const current = useWorkspace((s) => s.current);
  const recovered = useQuery({
    queryKey: queryKeys.recovery(),
    queryFn: () => recovery.get(),
    staleTime: 0,
  });
  const [confirm, setConfirm] = useState<{ name: string; run: () => void } | null>(null);

  /** Runs `action` now, or after confirming when it would drop changes that are not in a file. */
  function guard(action: () => void | Promise<void>) {
    const run = () => void Promise.resolve(action()).catch(() => toast(t('start.failed'), 'error'));
    // A read-only project (a newer file) loses nothing.
    const open = current?.store.getState();
    const editable = open && !open.readOnly ? open : undefined;
    const atRisk = editable
      ? saveStatusOf(editable) !== 'saved'
      : !current && recovered.data
        ? !recovered.data.savedToFile
        : false;
    const name = editable?.data.meta.name ?? recovered.data?.project.meta.name ?? '';
    if (atRisk) setConfirm({ name, run });
    else run();
  }

  const refreshRecovery = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.recovery() });
  const refreshRecent = () => void queryClient.invalidateQueries({ queryKey: queryKeys.recent() });

  function openProject(init: EditorInit) {
    workspace.getState().open(init);
    refreshRecovery();
    refreshRecent();
    navigate('/project/plan');
  }

  /**
   * Reads a picked file; a broken or unsupported file shows why and returns null. Main lists a
   * file as recent when it reads it, before knowing it is a project, so a failure drops it.
   */
  function read(bytes: Uint8Array, path?: string): OpenedProject | null {
    try {
      return readEpd(bytes);
    } catch (e) {
      toast(t(`start.openErrors.${e instanceof ProjectFileError ? e.code : 'invalid'}`), 'error');
      if (path !== undefined) void recent.remove(path).then(refreshRecent);
      return null;
    }
  }

  /** Open the file the user picks in the native dialog. */
  function openFile() {
    guard(async () => {
      const picked = await fileAccess.open();
      const opened = picked && read(picked.bytes, picked.path);
      if (picked && opened) {
        const { path, name, stat } = picked;
        openProject({ data: opened.project, assets: opened.assets, file: { path, name, stat } });
      }
    });
  }

  /** Open a path from the recent list or the OS; a file that is gone is explained and forgotten. */
  function openPath(path: string) {
    guard(async () => {
      const picked = await fileAccess.openPath(path);
      if (!picked) {
        toast(t('start.recent.gone', { name: path.split(/[\\/]/).pop() ?? path }), 'error');
        await recent.remove(path);
        refreshRecent();
        return;
      }
      const opened = read(picked.bytes, path);
      if (opened) {
        const { name, stat } = picked;
        openProject({ data: opened.project, assets: opened.assets, file: { path, name, stat } });
      }
    });
  }

  /** Closes the open project (back to the start screen); "Don't save" also drops its recovery copy. */
  function closeProject() {
    guard(async () => {
      const open = workspace.getState().current;
      if (!open) return;
      const s = open.store.getState();
      if (s.readOnly || saveStatusOf(s) === 'saved') workspace.getState().close();
      else {
        await open.autosave.discard();
        workspace.getState().close();
      }
      refreshRecovery();
      navigate('/');
    });
  }

  const dialog: ReactNode = (
    <Dialog
      open={confirm !== null}
      onOpenChange={(open) => !open && setConfirm(null)}
      title={t('start.replaceDraft.title')}
      description={t('start.replaceDraft.body', { name: confirm?.name ?? '' })}
      footer={
        <>
          <Button onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger-ghost"
            onClick={() => {
              const choice = confirm;
              setConfirm(null);
              choice?.run();
            }}
          >
            {t('start.replaceDraft.confirm')}
          </Button>
        </>
      }
    />
  );

  return {
    current,
    recovered,
    guard,
    refreshRecovery,
    openProject,
    read,
    openFile,
    openPath,
    closeProject,
    dialog,
  };
}
