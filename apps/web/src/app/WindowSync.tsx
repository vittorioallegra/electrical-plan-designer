import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { menuLabelKeys } from '@epd/bridge/bridge';
import type { MenuLabels } from '@/lib/repositories/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useSaveProject } from '@/features/editor/hooks/useSaveProject';
import { saveStatusOf, type EditorState } from '@/stores/editor/editorStore';
import { useEditorServices, useWorkspace } from '@/stores/editor/EditorContext';

const hasUnsavedChanges = (s: EditorState) => !s.readOnly && saveStatusOf(s) !== 'saved';

/**
 * Keeps the window in step with the open project: its name and unsaved state for the title and
 * the document-edited dot, and the Save / Don't save / Cancel question when the window closes or
 * the app quits with changes that are not in the file (Don't save deletes the recovery copy). Also
 * gives the native menu its texts and runs its Save, Save As, Undo and Redo.
 */
export function WindowSync() {
  const { t, i18n } = useTranslation();
  const { windowHost } = useEditorServices();
  const current = useWorkspace((s) => s.current);
  const store = current?.store ?? null;
  const saver = useSaveProject(store);
  const { save } = saver;
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    let last: string | undefined;
    const push = (s: EditorState | null) => {
      const state = {
        name: s ? s.data.meta.name : null,
        unsaved: s ? hasUnsavedChanges(s) : false,
      };
      const key = JSON.stringify(state);
      if (key === last) return;
      last = key;
      windowHost.setState(state);
    };
    push(store?.getState() ?? null);
    return store?.subscribe(push);
  }, [store, windowHost]);

  // The native menu speaks the app's language: its texts are sent at startup and on a change.
  useEffect(() => {
    windowHost.setMenuLabels(
      Object.fromEntries(menuLabelKeys.map((key) => [key, t(`menu.${key}`)])) as MenuLabels,
    );
  }, [windowHost, t, i18n.language]);

  // Menu items that act on the open project reuse the in-app actions (Save, Save As, Undo, Redo).
  useEffect(
    () =>
      windowHost.onMenuCommand(({ command }) => {
        if (command === 'save') void save();
        else if (command === 'saveAs') void save('saveAs');
        else if (command === 'undo' || command === 'redo') {
          // In a text field the menu's Undo/Redo belong to the field, as the shortcut does.
          const el = document.activeElement as HTMLElement | null;
          if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA'].includes(el.tagName)))
            document.execCommand(command);
          else if (store && !store.getState().readOnly) store.getState()[command]();
        }
      }),
    [windowHost, store, save],
  );

  useEffect(
    () =>
      windowHost.onCloseRequested(() => {
        const s = store?.getState();
        // Nothing to lose (the changes were saved while main was asking): just close.
        if (!s || !hasUnsavedChanges(s)) windowHost.answerClose('close');
        else setAsking(s.data.meta.name);
      }),
    [store, windowHost],
  );

  /** "Don't save": the recovery copy goes too, or it would be offered again at the next start. */
  async function discardAndClose() {
    setAsking(null);
    await current?.autosave.discard().catch(() => undefined);
    windowHost.answerClose('close');
  }

  async function saveAndClose() {
    setAsking(null);
    const saved = await save();
    // The copy is cleared as the file catches up; wait for it so it is not offered again.
    if (saved) await current?.autosave.writeNow().catch(() => undefined);
    windowHost.answerClose(saved ? 'close' : 'cancel');
  }

  return (
    <>
      {saver.dialog}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (open) return;
          setAsking(null);
          windowHost.answerClose('cancel');
        }}
        title={t('editor.close.title', { name: asking ?? '' })}
        description={t('editor.close.body')}
        footer={
          <>
            <Button
              onClick={() => {
                setAsking(null);
                windowHost.answerClose('cancel');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="danger-ghost" onClick={() => void discardAndClose()}>
              {t('editor.close.discard')}
            </Button>
            <Button variant="primary" onClick={() => void saveAndClose()}>
              {t('editor.save')}
            </Button>
          </>
        }
      />
    </>
  );
}
