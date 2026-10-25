import type * as PdfJsModule from 'pdfjs-dist';

// Turns a user file into a background image: PDFs render one page to PNG (max 4096 px side).
export const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024;
export const MAX_RENDER_SIDE = 4096;

export type ImportErrorCode =
  'oversize' | 'unsupported' | 'encrypted' | 'corrupt' | 'render_failed';

export class ImportError extends Error {
  override name = 'ImportError';
  constructor(readonly code: ImportErrorCode) {
    super(code);
  }
}

export function checkFile(file: File): 'pdf' | 'image' {
  if (file.size > MAX_BACKGROUND_BYTES) throw new ImportError('oversize');
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (file.type === 'image/png' || file.type === 'image/jpeg') return 'image';
  throw new ImportError('unsupported');
}

type PdfJs = typeof PdfJsModule;
let pdfjsPromise: Promise<PdfJs> | undefined;

async function pdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjsPromise;
}

export interface PdfHandle {
  pageCount: number;
  thumbnail(page: number, width: number): Promise<string>;
  render(page: number): Promise<{ blob: Blob; width: number; height: number }>;
  destroy(): void;
}

export async function openPdf(file: File): Promise<PdfHandle> {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    throw new ImportError((e as Error).name === 'PasswordException' ? 'encrypted' : 'corrupt');
  }
  const renderTo = async (pageNumber: number, scaleFor: (w: number, h: number) => number) => {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: scaleFor(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new ImportError('render_failed');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return canvas;
  };
  return {
    pageCount: doc.numPages,
    async thumbnail(page, width) {
      const canvas = await renderTo(page, (w) => width / w);
      return canvas.toDataURL('image/png');
    },
    async render(page) {
      const canvas = await renderTo(page, (w, h) => Math.min(MAX_RENDER_SIDE / Math.max(w, h), 4));
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new ImportError('render_failed');
      return { blob, width: canvas.width, height: canvas.height };
    },
    destroy: () => void task.destroy(),
  };
}

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImportError('corrupt'));
    img.src = URL.createObjectURL(blob);
  });
}
