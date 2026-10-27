import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadDoc } from '@epd/domain/load';
import { useToast } from '@/components/ui/Toast';
import { fileSafe } from '@/lib/download';
import { exportFilters, useExportFile } from '@/hooks/useExportFile';
import { useEditorContext, useEditorServices } from '@/stores/editor/EditorContext';
import { useProjectPdfExport } from '@/features/exports/hooks/useProjectPdfExport';

export interface ProjectTransfer {
  /** The project PDF is being built. */
  exporting: boolean;
  exportPdf(): Promise<void>;
  exportJson(): void;
  /** Replaces the project's document with the JSON file's (one undoable change). */
  importJson(file: File): Promise<void>;
  /** Asks for the JSON file in a dialog that needs no click in the page (the native menu), then imports it. */
  importJsonFromDialog(): Promise<void>;
}

/** The open project's PDF and JSON export and JSON import, shared by the top bar and the menu. */
export function useProjectTransfer(): ProjectTransfer {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const { fileAccess } = useEditorServices();
  const toast = useToast();
  const projectPdf = useProjectPdfExport();
  const exportFile = useExportFile();
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

  async function importJsonFromDialog() {
    let file: File | null;
    try {
      file = await fileAccess.openImport(exportFilters.json);
    } catch {
      toast(t('editor.importFailed'), 'error');
      return;
    }
    if (file) await importJson(file);
  }

  return { exporting, exportPdf, exportJson, importJson, importJsonFromDialog };
}
