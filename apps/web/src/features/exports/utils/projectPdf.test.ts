// @vitest-environment node
import { describe, expect, it } from 'vitest';
import demo from '../../../../../../tests/fixtures/demo-project.json';
import { computeBom } from '@epd/domain/bom';
import { createCatalogLookup } from '@epd/domain/catalog/lookup';
import { runChecks } from '@epd/domain/checks';
import { defaultProjectSettings } from '@epd/domain/defaults';
import { routeDoc } from '@epd/domain/routing';
import type { ProjectDoc } from '@epd/domain/types';
import { createI18n } from '@/lib/i18n';
import { pdfText } from '@/testing/pdfText';
import { buildProjectPdf, rotatedImageBox } from './projectPdf';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function demoInput() {
  const doc = structuredClone(demo) as unknown as ProjectDoc;
  doc.floors[0]!.background = {
    assetId: 'user/project/f0.png',
    kind: 'image',
    widthPx: 1000,
    heightPx: 600,
    offset: { x: -1, y: -1 },
    rotation: 0,
    opacity: 0.5,
  };
  const settings = defaultProjectSettings();
  const lookup = createCatalogLookup();
  const routing = routeDoc(doc, settings);
  return {
    meta: { name: 'Demo house', clientName: 'Demo client', address: 'Via Roma 1' },
    doc,
    analysis: {
      routing,
      bom: computeBom(doc, settings, lookup, routing),
      warnings: runChecks(doc, settings, lookup, routing),
    },
    lookup,
    backgrounds: new Map([['f0', { dataUrl: PNG_1PX, width: 1, height: 1 }]]),
    businessName: 'Demo Electric',
    t: createI18n('en').t,
    locale: 'en' as const,
    now: new Date('2026-10-25T00:00:00Z'),
  };
}

describe('project PDF', () => {
  // protects=AC 15 project PDF sections, with a private floor background; fails_when=a section is missing or the background breaks the export; no_claim=drawing accuracy
  it('renders cover, floors, panel, circuits, segments, BOM and warnings', async () => {
    const pdf = buildProjectPdf(demoInput());
    const bytes = pdf.bytes();
    const { pages, text } = await pdfText(bytes);
    const all = text.join('\n');
    expect(pages).toBeGreaterThanOrEqual(7);
    expect(text[0]).toContain('Demo house');
    expect(text[0]).toContain('Client: Demo client');
    expect(text[0]).toContain('3 floors · 3 circuits · 10 conduit segments');
    expect(text[1]).toContain('Floor plan: Ground floor');
    expect(text[1]).toContain('Kitchen socket');
    expect(text[1]).toContain('S1');
    expect(all).toContain('Panel Q1');
    expect(all).toContain('Lights GF (Lighting)');
    expect(all).toContain('Kitchen socket');
    expect(all).toContain('Riser');
    // Only WinAnsi characters: anything else makes jsPDF re-encode and space out the text.
    expect(all).toContain('Q1 – JB1');
    expect(all).toContain('Bill of materials');
    expect(all).toContain('Boxes without plate or devices (1)');
    // pdfjs takes ownership of the buffer it parses, so read the raw PDF again.
    expect(pdf.doc.output()).toContain('/Subtype /Image');
  });
});

describe('rotated background placement', () => {
  // protects=background rotation in the PDF; fails_when=the image corner or direction does not match the plan; no_claim=—
  it('puts the top-left corner and the x axis where the plan has them', () => {
    // jsPDF (y-down page, pageH): translate(x, pageH - (y + h)) · rotate(angle CCW) · scale(w, h);
    // the image's top-left is unit point (0, 1), its top-right (1, 1).
    const pageH = 297;
    const map = (box: ReturnType<typeof rotatedImageBox>, u: number, v: number) => {
      const r = (box.angle * Math.PI) / 180;
      const [c, s] = [Math.cos(r), Math.sin(r)];
      const X = box.x + c * u * box.w - s * v * box.h;
      const Y = pageH - (box.y + box.h) + s * u * box.w + c * v * box.h;
      return { x: X, y: pageH - Y };
    };
    for (const rotation of [0, 30, 90, -45]) {
      const box = rotatedImageBox({ x: 50, y: 80 }, 40, 20, rotation);
      const tl = map(box, 0, 1);
      const tr = map(box, 1, 1);
      expect(tl.x).toBeCloseTo(50, 6);
      expect(tl.y).toBeCloseTo(80, 6);
      const rad = (rotation * Math.PI) / 180;
      expect(tr.x - tl.x).toBeCloseTo(40 * Math.cos(rad), 6);
      expect(tr.y - tl.y).toBeCloseTo(40 * Math.sin(rad), 6);
    }
  });
});
