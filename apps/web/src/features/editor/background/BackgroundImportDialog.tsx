import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newId } from '@epd/domain/ids';
import type { Background } from '@epd/domain/types';
import { useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { cn } from '@/lib/cn';
import { usePrimeBackgroundImage } from '../canvas/useBackgroundImage';
import { checkFile, ImportError, loadImage, openPdf, type PdfHandle } from './importFile';

const MAX_THUMBNAILS = 30;

type Step =
  | { kind: 'pick' }
  | { kind: 'reading' }
  | { kind: 'pages'; pdf: PdfHandle; thumbs: (string | null)[]; selected: number };

export function BackgroundImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mounted only while open, so every import starts from a clean state.
  return open ? <ImportDialogBody onClose={onClose} /> : null;
}

function ImportDialogBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
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

  /** Keeps the image as a project asset and sets it as the current floor's background. */
  async function applyImage(
    blob: Blob,
    image: HTMLImageElement,
    kind: Background['kind'],
    page?: number,
  ) {
    const assetId = newId();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const s = store.getState();
    s.addAsset(assetId, {
      mimeType: blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      bytes,
    });
    primeBackgroundImage(assetId, image);
    const floorId = s.ui.floorId;
    s.applyCommand('import background', (d) => {
      const floor = d.doc.floors.find((f) => f.id === floorId);
      if (!floor) return;
      floor.background = {
        assetId,
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
  }

  async function onFile(file: File) {
    setError(null);
    try {
      const kind = checkFile(file);
      setStep({ kind: 'reading' });
      if (kind === 'image') {
        const image = await loadImage(file);
        await applyImage(file, image, 'image');
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
      await applyImage(blob, image, 'pdf', page);
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
        <FileDropZone
          accept="application/pdf,image/png,image/jpeg"
          inputTestId="background-file"
          onFile={(file) => void onFile(file)}
        />
      ) : null}
      {step.kind === 'reading' ? <p role="status">{t('background.reading')}</p> : null}
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
