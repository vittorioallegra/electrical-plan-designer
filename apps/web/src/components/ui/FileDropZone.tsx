import { Upload } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface FileDropZoneProps {
  accept: string;
  onFile: (file: File) => void;
  /** Test id of the hidden file input (Playwright `setInputFiles`). */
  inputTestId?: string;
}

const hasFiles = (e: DragEvent | globalThis.DragEvent) =>
  e.dataTransfer?.types.includes('Files') ?? false;

/** Area to drop one file on, with a "Choose file" button as the fallback. */
export function FileDropZone({ accept, onFile, inputTestId }: FileDropZoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // A file dropped next to the zone would make the browser open it and leave the app.
  useEffect(() => {
    const block = (e: globalThis.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  return (
    <div
      data-testid="file-drop-zone"
      data-dragging={dragging || undefined}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors duration-[80ms]',
        dragging ? 'border-accent bg-accent-subtle' : 'border-border-strong bg-chrome',
      )}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <Upload className="size-5 text-text-muted" aria-hidden />
      <p className="font-medium">{t('fileDrop.drag')}</p>
      <p className="text-text-muted">{t('fileDrop.or')}</p>
      <Button onClick={() => inputRef.current?.click()}>{t('fileDrop.choose')}</Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={inputTestId}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
