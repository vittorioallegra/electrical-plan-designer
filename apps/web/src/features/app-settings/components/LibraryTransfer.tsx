import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LibraryError } from '@epd/domain/library';
import { readEpl, writeEpl } from '@/lib/libraryFile/epl';
import type { LibraryData } from '@/lib/repositories/types';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { exportFilters, useExportFile } from '@/hooks/useExportFile';

/** Export the whole library as one `.epl` file, or replace it with one (after a confirmation). */
export function LibraryTransfer() {
  const { t } = useTranslation();
  const { library } = useEditorServices();
  const toast = useToast();
  const exportFile = useExportFile();
  const input = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<{ name: string; data: LibraryData } | null>(null);
  const [replacing, setReplacing] = useState(false);

  async function exportLibrary() {
    const { library: current, logo } = library.getState();
    const bytes = writeEpl({ library: current, logo }, new Date());
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
    if (await exportFile('library.epl', blob, exportFilters.library))
      toast(t('library.export.done'), 'success');
  }

  async function pick(file: File) {
    try {
      setIncoming({ name: file.name, data: readEpl(new Uint8Array(await file.arrayBuffer())) });
    } catch (error) {
      const code = error instanceof LibraryError ? error.code : 'invalid';
      toast(t(`library.import.errors.${code}`), 'error');
    }
  }

  async function replace() {
    if (!incoming || replacing) return;
    setReplacing(true);
    try {
      await library.getState().replaceAll(incoming.data);
      toast(t('library.import.done'), 'success');
    } catch {
      toast(t('library.import.failed'), 'error');
    } finally {
      setReplacing(false);
      setIncoming(null);
    }
  }

  return (
    <>
      <Button onClick={() => void exportLibrary()}>{t('library.export.action')}</Button>
      <Button onClick={() => input.current?.click()}>{t('library.import.action')}</Button>
      <input
        ref={input}
        type="file"
        accept=".epl"
        className="hidden"
        data-testid="library-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void pick(file);
        }}
      />
      <Dialog
        open={incoming !== null}
        onOpenChange={(open) => !open && setIncoming(null)}
        title={t('library.import.title')}
        description={
          incoming
            ? t('library.import.body', {
                name: incoming.name,
                count: incoming.data.library.catalogs.length,
              })
            : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setIncoming(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger-ghost" disabled={replacing} onClick={() => void replace()}>
              {t('library.import.confirm')}
            </Button>
          </>
        }
      />
    </>
  );
}
