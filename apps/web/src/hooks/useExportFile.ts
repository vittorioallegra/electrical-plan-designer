import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/Toast';
import type { ExportFilter } from '@/lib/repositories/types';
import { useEditorServices } from '@/stores/editor/EditorContext';

/** Save-dialog file types of the exports. */
export const exportFilters = {
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  csv: [{ name: 'CSV', extensions: ['csv'] }],
  json: [{ name: 'JSON', extensions: ['json'] }],
  catalog: [{ name: 'Catalog', extensions: ['epc'] }],
  library: [{ name: 'Library', extensions: ['epl'] }],
} satisfies Record<string, ExportFilter[]>;

/**
 * Exports a file (PDF, CSV, JSON, catalog) through the native save dialog. Shows the OS error
 * when the write fails; resolves true only when the file was written.
 */
export function useExportFile() {
  const { t } = useTranslation();
  const toast = useToast();
  const { fileAccess } = useEditorServices();
  return useCallback(
    async (name: string, blob: Blob, filters: ExportFilter[]): Promise<boolean> => {
      const result = await fileAccess.exportFile(name, blob, filters);
      if (result.status === 'failed')
        toast(t('common.writeFailed', { code: result.code }), 'error');
      return result.status === 'saved';
    },
    [fileAccess, toast, t],
  );
}
