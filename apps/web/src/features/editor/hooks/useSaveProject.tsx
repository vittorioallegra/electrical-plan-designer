import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { useEditorServices } from '@/stores/editor/EditorContext';
import type { EditorStore } from '@/stores/editor/editorStore';
import { saveProject, type SaveMode } from '@/stores/editor/saveProject';

type Problem = { kind: 'conflict' } | { kind: 'failed'; code: string };
type Choice = 'overwrite' | 'saveAs' | 'cancel';

/**
 * Save: writes the project over its file, or asks where to save a project with none (Save As).
 * When the file changed on disk it asks: overwrite, Save As or cancel; when the file cannot be
 * written it shows the OS error and offers Save As. `save()` resolves true once the project is
 * in a file, false when the user cancelled or nothing was saved. Render `dialog` in the page.
 * Changes made after the file was built stay unsaved.
 */
export function useSaveProject(store: EditorStore | null) {
  const { t } = useTranslation();
  const toast = useToast();
  const { fileAccess } = useEditorServices();
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState<{ problem: Problem; answer: (c: Choice) => void } | null>(
    null,
  );

  const ask = useCallback(
    (problem: Problem) =>
      new Promise<Choice>((resolve) => {
        setAsking({
          problem,
          answer: (choice) => {
            setAsking(null);
            resolve(choice);
          },
        });
      }),
    [],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!store || store.getState().readOnly || inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    try {
      let mode: SaveMode = 'auto';
      for (;;) {
        const outcome = await saveProject(store, fileAccess, mode);
        if (outcome.kind === 'saved') {
          toast(t('editor.savedTo', { name: outcome.file.name }), 'success');
          return true;
        }
        if (outcome.kind === 'cancelled') return false;
        const choice = await ask(
          outcome.kind === 'conflict'
            ? { kind: 'conflict' }
            : { kind: 'failed', code: outcome.code },
        );
        if (choice === 'cancel') return false;
        mode = choice;
      }
    } catch (e) {
      console.error(e);
      toast(t('editor.saveFailed'), 'error');
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [store, fileAccess, toast, t, ask]);

  const problem = asking?.problem;
  const dialog: ReactNode = (
    <Dialog
      open={asking !== null}
      onOpenChange={(open) => !open && asking?.answer('cancel')}
      title={t(problem?.kind === 'failed' ? 'editor.writeFailed.title' : 'editor.conflict.title')}
      description={
        problem?.kind === 'failed'
          ? t('editor.writeFailed.body', { code: problem.code })
          : t('editor.conflict.body')
      }
      footer={
        <>
          <Button onClick={() => asking?.answer('cancel')}>{t('common.cancel')}</Button>
          <Button
            variant={problem?.kind === 'failed' ? 'primary' : 'secondary'}
            onClick={() => asking?.answer('saveAs')}
          >
            {t('editor.saveAs')}
          </Button>
          {problem?.kind === 'conflict' ? (
            <Button variant="danger" onClick={() => asking?.answer('overwrite')}>
              {t('editor.conflict.overwrite')}
            </Button>
          ) : null}
        </>
      }
    />
  );

  return { save, saving, dialog };
}
