import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@/config/version';
import { fileSafe } from '@/lib/download';
import { writeEpd } from '@/lib/projectFile/epd';
import { useEditorContext, useEditorServices } from '@/stores/editor/EditorContext';
import { useToast } from '@/components/ui/Toast';

/**
 * Save (overwrites the opened file, or asks where for a new project) and Save as. A failed
 * write leaves the file and the draft as they were; changes made while saving stay unsaved.
 */
export function useSaveProject() {
  const { t } = useTranslation();
  const toast = useToast();
  const { store } = useEditorContext();
  const { fileAccess } = useEditorServices();
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (as: boolean) => {
      const s = store.getState();
      if (s.readOnly || inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      try {
        const bytes = writeEpd(s.data, s.assets, { appVersion: APP_VERSION, now: new Date() });
        const file =
          s.file && !as
            ? await fileAccess.save(s.file, bytes)
            : await fileAccess.saveAs(bytes, `${fileSafe(s.data.meta.name)}.epd`);
        if (!file) return;
        store.getState().markSaved(s.revision, file);
        toast(t('editor.savedTo', { name: file.name }), 'success');
      } catch (e) {
        console.error(e);
        toast(t('editor.saveFailed'), 'error');
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [store, fileAccess, toast, t],
  );

  return useMemo(
    () => ({ save: () => save(false), saveAs: () => save(true), saving }),
    [save, saving],
  );
}
