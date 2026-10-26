import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@/config/version';
import { fileSafe } from '@/lib/download';
import { writeEpd } from '@/lib/projectFile/epd';
import { useEditorContext, useEditorServices } from '@/stores/editor/EditorContext';
import { useToast } from '@/components/ui/Toast';

/**
 * Save: downloads the project as `<name>.epd` on every browser; nothing on disk is ever
 * overwritten. Changes made after building the file stay unsaved.
 */
export function useSaveProject() {
  const { t } = useTranslation();
  const toast = useToast();
  const { store } = useEditorContext();
  const { fileAccess } = useEditorServices();
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);

  const save = useCallback(() => {
    const s = store.getState();
    if (s.readOnly || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const bytes = writeEpd(s.data, s.assets, { appVersion: APP_VERSION, now: new Date() });
      const name = `${fileSafe(s.data.meta.name)}.epd`;
      fileAccess.download(bytes, name);
      store.getState().markSaved(s.revision);
      toast(t('editor.savedTo', { name }), 'success');
    } catch (e) {
      console.error(e);
      toast(t('editor.saveFailed'), 'error');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [store, fileAccess, toast, t]);

  return useMemo(() => ({ save, saving }), [save, saving]);
}
