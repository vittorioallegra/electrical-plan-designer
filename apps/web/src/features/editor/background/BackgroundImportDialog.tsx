import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/lib/repositories/provider';
import { newId } from '@epd/domain/ids';
import type { Background } from '@epd/domain/types';
import { useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/auth/AuthProvider';
import { usePrimeBackgroundImage } from '../canvas/useBackgroundImage';
import { checkFile, ImportError, loadImage, openPdf, type PdfHandle } from './importFile';

const MAX_THUMBNAILS = 30;

type Step =
  | { kind: 'pick' }
  | { kind: 'reading' }
  | { kind: 'pages'; pdf: PdfHandle; thumbs: (string | null)[]; selected: number }
  | { kind: 'uploading' }
  | { kind: 'upload_failed'; retry: () => void };

export function BackgroundImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mounted only while open, so every import starts from a clean state.
  return open ? <ImportDialogBody onClose={onClose} /> : null;
}

function ImportDialogBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { files } = useRepositories();
  const session = useSession();
  const primeBackgroundImage = usePrimeBackgroundImage();
  const { store } = useEditorContext();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<PdfHandle | null>(null);

  useEffect(
    () => () => {
      pdfRef.current?.destroy();
    },
    [],
  );

  async function upload(
    blob: Blob,
    image: HTMLImageElement,
    kind: Background['kind'],
    page?: number,
  ) {
    const s = store.getState();
    const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const path = `${session.userId}/${s.projectId}/${newId()}.${ext}`;
    const attempt = async () => {
      setStep({ kind: 'uploading' });
      setError(null);
      try {
        await files.upload('backgrounds', path, blob);
      } catch {
        setError(t('background.errors.upload_failed'));
        setStep({ kind: 'upload_failed', retry: () => void attempt() });
        return;
      }
      primeBackgroundImage(path, image);
      const floorId = store.getState().ui.floorId;
      store.getState().applyCommand('import background', (d) => {
        const floor = d.doc.floors.find((f) => f.id === floorId);
        if (!floor) return;
        floor.background = {
          storagePath: path,
          kind,
          ...(page ? { page } : {}),
          widthPx: image.naturalWidth || image.width,
          heightPx: image.naturalHeight || image.height,
          offset: { x: 0, y: 0 },
          rotation: 0,
          opacity: 0.4,
        };
      });
      onClose();
    };
    await attempt();
  }

  async function onFile(file: File) {
    setError(null);
    try {
      const kind = checkFile(file);
      setStep({ kind: 'reading' });
      if (kind === 'image') {
        const image = await loadImage(file);
        await upload(file, image, 'image');
        return;
      }
      const pdf = await openPdf(file);
      pdfRef.current = pdf;
      if (pdf.pageCount === 1) {
        await pickPage(pdf, 1);
        return;
      }
      const count = Math.min(pdf.pageCount, MAX_THUMBNAILS);
      const thumbs: (string | null)[] = Array(count).fill(null);
      setStep({ kind: 'pages', pdf, thumbs, selected: 1 });
      for (let i = 0; i < count; i++) {
        thumbs[i] = await pdf.thumbnail(i + 1, 140).catch(() => null);
        setStep((s) => (s.kind === 'pages' ? { ...s, thumbs: [...thumbs] } : s));
      }
    } catch (e) {
      setError(t(`background.errors.${e instanceof ImportError ? e.code : 'corrupt'}`));
      setStep({ kind: 'pick' });
    }
  }

  async function pickPage(pdf: PdfHandle, page: number) {
    setStep({ kind: 'reading' });
    try {
      const { blob } = await pdf.render(page);
      const image = await loadImage(blob);
      await upload(blob, image, 'pdf', page);
    } catch (e) {
      setError(t(`background.errors.${e instanceof ImportError ? e.code : 'render_failed'}`));
      setStep({ kind: 'pick' });
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('background.importTitle')}
      description={t('background.importHint')}
      footer={
        step.kind === 'pages' ? (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={() => void pickPage(step.pdf, step.selected)}>
              {t('background.usePage', { page: step.selected })}
            </Button>
          </>
        ) : step.kind === 'upload_failed' ? (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={step.retry}>
              {t('background.retryUpload')}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        )
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded bg-error-bg px-2 py-1 text-error">
          {error}
        </p>
      ) : null}
      {step.kind === 'pick' ? (
        <label className="flex flex-col gap-1">
          {t('background.file')}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            data-testid="background-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onFile(file);
            }}
          />
        </label>
      ) : null}
      {step.kind === 'reading' ? <p role="status">{t('background.reading')}</p> : null}
      {step.kind === 'uploading' ? <p role="status">{t('background.uploading')}</p> : null}
      {step.kind === 'pages' ? (
        <div
          className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto"
          role="listbox"
          aria-label={t('background.pages')}
        >
          {step.thumbs.map((thumb, i) => (
            <button
              key={i}
              role="option"
              aria-selected={step.selected === i + 1}
              className={cn(
                'flex flex-col items-center gap-1 rounded border p-1',
                step.selected === i + 1 ? 'border-accent' : 'border-border',
              )}
              onClick={() => setStep({ ...step, selected: i + 1 })}
            >
              {thumb ? <img src={thumb} alt="" className="max-h-28" /> : <span className="h-28" />}
              <span>{t('background.page', { page: i + 1 })}</span>
            </button>
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}
