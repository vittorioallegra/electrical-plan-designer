// Small layout helpers on top of jsPDF: a cursor that flows text and tables across A4 pages.
// Built-in Helvetica (WinAnsi) covers €, ², Ø and Italian accents, so no font is embedded.
import { jsPDF } from 'jspdf';

export const PAGE = { width: 210, height: 297, margin: 15 } as const;
export const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;

export interface ImageData {
  dataUrl: string;
  /** Natural size in px, for the aspect ratio. */
  width: number;
  height: number;
}

export interface TableColumn {
  header: string;
  /** Width in mm; the columns should add up to CONTENT_WIDTH. */
  width: number;
  align?: 'left' | 'right';
}

export class PdfWriter {
  readonly doc = new jsPDF({ unit: 'mm', format: 'a4' });
  y: number = PAGE.margin;

  constructor() {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
  }

  newPage(): void {
    this.doc.addPage();
    this.y = PAGE.margin;
  }

  /** Starts a new page when fewer than `mm` are left. */
  ensure(mm: number): void {
    if (this.y + mm > PAGE.height - PAGE.margin) this.newPage();
  }

  heading(text: string, size = 14): void {
    this.ensure(size * 0.6 + 4);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(size);
    this.y += size * 0.35;
    this.doc.text(text, PAGE.margin, this.y);
    this.y += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
  }

  /** Wrapped paragraph lines; empty strings are skipped. */
  lines(texts: readonly string[], x: number = PAGE.margin, width: number = CONTENT_WIDTH): void {
    for (const text of texts) {
      if (!text) continue;
      for (const line of this.doc.splitTextToSize(text, width) as string[]) {
        this.ensure(5);
        this.y += 4.2;
        this.doc.text(line, x, this.y);
      }
    }
  }

  gap(mm = 4): void {
    this.y += mm;
  }

  /** Image scaled to fit the box, keeping its aspect ratio; returns the drawn size. */
  image(img: ImageData, x: number, y: number, maxW: number, maxH: number) {
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    this.doc.addImage(img.dataUrl, imageFormat(img.dataUrl), x, y, w, h);
    return { w, h };
  }

  /** Table with a bold header row, repeated after page breaks. Cells wrap. */
  table(columns: readonly TableColumn[], rows: readonly string[][]): void {
    const lineH = 4.2;
    const drawRow = (cells: readonly string[], bold: boolean) => {
      this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const wrapped = cells.map(
        (c, i) => this.doc.splitTextToSize(c, columns[i]!.width - 2) as string[],
      );
      const height = Math.max(1, ...wrapped.map((w) => w.length)) * lineH + 1.5;
      if (this.y + height > PAGE.height - PAGE.margin) {
        this.newPage();
        if (!bold)
          drawRow(
            columns.map((c) => c.header),
            true,
          );
        this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
      }
      let x = PAGE.margin;
      wrapped.forEach((cellLines, i) => {
        const col = columns[i]!;
        cellLines.forEach((line, j) => {
          const ty = this.y + lineH * (j + 1);
          if (col.align === 'right') this.doc.text(line, x + col.width - 1, ty, { align: 'right' });
          else this.doc.text(line, x + 1, ty);
        });
        x += col.width;
      });
      this.y += height;
      this.doc.setDrawColor(200);
      this.doc.line(PAGE.margin, this.y, PAGE.margin + CONTENT_WIDTH, this.y);
    };
    drawRow(
      columns.map((c) => c.header),
      true,
    );
    for (const row of rows) drawRow(row, false);
    this.doc.setFont('helvetica', 'normal');
    this.gap(3);
  }

  /** Label/value pairs right-aligned in a box at the right edge. */
  summary(rows: readonly [label: string, value: string, bold?: boolean][], width = 80): void {
    const x = PAGE.margin + CONTENT_WIDTH - width;
    for (const [label, value, bold] of rows) {
      this.ensure(6);
      this.y += 5;
      this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
      this.doc.text(label, x, this.y);
      this.doc.text(value, PAGE.margin + CONTENT_WIDTH, this.y, { align: 'right' });
    }
    this.doc.setFont('helvetica', 'normal');
  }

  bytes(): ArrayBuffer {
    return this.doc.output('arraybuffer');
  }
}

export function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
}

/** Reads a blob (logo, background) into an ImageData with its natural size. Browser only. */
export async function blobToImage(blob: Blob): Promise<ImageData> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = dataUrl;
    },
  );
  return { dataUrl, width, height };
}
