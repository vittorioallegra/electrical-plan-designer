// Project detail PDF: cover, one page per floor, panel front view, circuit and segment
// tables, BOM and open warnings. Drawn as vectors from the document, never from the canvas.
import type { TFunction } from 'i18next';
import { GState } from 'jspdf';
import { bomCategoryOrder, type BomLine } from '@epd/domain/bom';
import type { CatalogLookup } from '@epd/domain/catalog/lookup';
import type { Warning } from '@epd/domain/checks';
import {
  backgroundMetersPerPixel,
  backgroundToWorld,
  mmToM,
  polylineLength,
} from '@epd/domain/geometry';
import type { RoutingResult } from '@epd/domain/routing';
import type {
  Background,
  Floor,
  Point,
  ProjectDoc,
  ProjectMeta,
  RunElevation,
} from '@epd/domain/types';
import { formatLength, formatNumber, type Locale } from '@/lib/format';
import { describeBomLine } from '@/lib/describeBom';
import { checkOrder, describeWarning } from '@/lib/describeChecks';
import { CONTENT_WIDTH, imageFormat, PAGE, PdfWriter, type ImageData } from './pdfKit';

export interface ProjectPdfInput {
  meta: Pick<ProjectMeta, 'name' | 'clientName' | 'address'>;
  doc: ProjectDoc;
  analysis: { routing: RoutingResult; bom: BomLine[]; warnings: Warning[] };
  lookup: CatalogLookup;
  /** Downloaded floor backgrounds by floor id. */
  backgrounds: ReadonlyMap<string, ImageData>;
  businessName: string;
  t: TFunction;
  locale: Locale;
  now: Date;
}

const RUN_COLORS: Record<RunElevation, [number, number, number]> = {
  floor: [37, 99, 235],
  ceiling: [234, 88, 12],
  direct: [124, 58, 237],
};

/**
 * Where to call jsPDF's addImage so a background lands with its top-left corner at `tl`
 * (page mm), `w × h` mm, rotated clockwise by `rotation` degrees like on the plan.
 * jsPDF rotates counter-clockwise around the bottom-left corner of the box it is given.
 */
export function rotatedImageBox(tl: Point, w: number, h: number, rotation: number) {
  const r = (rotation * Math.PI) / 180;
  return { x: tl.x - h * Math.sin(r), y: tl.y - h * (1 - Math.cos(r)), w, h, angle: -rotation };
}

function backgroundCorners(bg: Background): Point[] {
  const mpp = backgroundMetersPerPixel(bg);
  const withScale = {
    ...bg,
    calibration: { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, realDistance: mpp },
  };
  return [
    { x: 0, y: 0 },
    { x: bg.widthPx, y: 0 },
    { x: bg.widthPx, y: bg.heightPx },
    { x: 0, y: bg.heightPx },
  ].map((p) => backgroundToWorld(withScale, p)!);
}

export function buildProjectPdf(input: ProjectPdfInput): PdfWriter {
  const { meta, doc, analysis, lookup, t, locale } = input;
  const pdf = new PdfWriter();
  const itemName = (id: string | undefined) => {
    const item = id ? lookup(id) : undefined;
    if (!item) return id ? t('catalog.missingItem', { id }) : '—';
    return item.ownerId === null ? t(item.name) : item.name;
  };
  const nodeLabel = (id: string) => doc.nodes.find((n) => n.id === id)?.label || '?';
  const floors = [...doc.floors].sort((a, b) => a.order - b.order);
  const floorName = (id: string | undefined) => floors.find((f) => f.id === id)?.name ?? '?';
  const segmentNo = new Map(doc.segments.map((s, i) => [s.id, `S${i + 1}`]));
  const meters = (mm: number) => formatLength(mmToM(mm), locale);

  // Cover.
  pdf.gap(40);
  pdf.heading(meta.name, 24);
  pdf.gap(4);
  pdf.lines([
    t('pdf.client', { name: meta.clientName || '—' }),
    meta.address ? t('pdf.siteAddress', { address: meta.address }) : '',
    t('pdf.date', {
      date: new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
        dateStyle: 'long',
      }).format(input.now),
    }),
    input.businessName,
  ]);
  pdf.gap(8);
  pdf.lines([
    t('pdf.summary', {
      floors: floors.length,
      circuits: doc.circuits.length,
      segments: doc.segments.length,
      warnings: analysis.warnings.length,
    }),
  ]);

  for (const floor of floors) drawFloor(pdf, input, floor, segmentNo);

  // Panel front view.
  const panel = doc.panels[0];
  if (panel) {
    pdf.newPage();
    pdf.heading(t('pdf.panelTitle', { label: nodeLabel(panel.nodeId) }));
    pdf.lines([t('pdf.enclosure', { name: itemName(panel.enclosureItemId) })]);
    pdf.gap(4);
    const moduleW = Math.min(9, CONTENT_WIDTH / panel.modulesPerRail);
    const railH = 28;
    for (let rail = 0; rail < panel.dinRails; rail++) {
      pdf.ensure(railH + 6);
      const y = pdf.y;
      pdf.doc.setDrawColor(120);
      pdf.doc.rect(PAGE.margin, y, moduleW * panel.modulesPerRail, railH);
      pdf.doc.setFontSize(7);
      for (const d of panel.devices.filter((x) => x.rail === rail)) {
        const width = Math.max(1, lookup(d.itemId)?.modules ?? 1) * moduleW;
        const x = PAGE.margin + d.slot * moduleW;
        pdf.doc.setFillColor(241, 245, 249);
        pdf.doc.rect(x + 0.5, y + 2, width - 1, railH - 4, 'FD');
        const text = pdf.doc.splitTextToSize(d.label || itemName(d.itemId), width - 2) as string[];
        pdf.doc.text(text.slice(0, 4), x + 1.2, y + 6);
      }
      pdf.doc.setFontSize(10);
      pdf.y = y + railH + 4;
    }
  }

  // Circuits.
  pdf.newPage();
  pdf.heading(t('pdf.circuitsTitle'));
  pdf.table(
    [
      { header: t('circuits.name'), width: 32 },
      { header: t('circuits.device'), width: 28 },
      { header: t('circuits.section'), width: 18, align: 'right' },
      { header: t('circuits.conductors'), width: 40 },
      { header: t('circuits.targetsTitle'), width: 42 },
      { header: t('pdf.route'), width: CONTENT_WIDTH - 160, align: 'right' },
    ],
    doc.circuits.map((c) => {
      const device = panel?.devices.find((d) => d.id === c.panelDeviceId);
      const route = analysis.routing.circuitRoutes.get(c.id);
      const routeText = !route
        ? '—'
        : !route.ok
          ? t(`circuits.problems.${route.problem}`)
          : meters(
              route.segmentIds.reduce((sum, id) => {
                const s = doc.segments.find((x) => x.id === id);
                return sum + (s ? analysis.routing.ctx.segmentLengthMm(s) : 0);
              }, 0),
            );
      return [
        `${c.name} (${t(`circuits.types.${c.type}`)})`,
        device ? device.label || itemName(device.itemId) : '—',
        t('units.mm2', { value: formatNumber(c.crossSection, locale) }),
        c.conductors
          .map((x) => `${t(`conductorRoles.${x.role}`)} ${t(`colors.${x.color}`)}`)
          .join(', '),
        c.targetNodeIds.map(nodeLabel).join(', '),
        routeText,
      ];
    }),
  );

  // Segments.
  pdf.heading(t('pdf.segmentsTitle'));
  pdf.table(
    [
      { header: '#', width: 12 },
      { header: t('pdf.ends'), width: 50 },
      { header: t('pdf.floor'), width: 28 },
      { header: t('inspector.segment.runElevation'), width: 30 },
      { header: t('pdf.conduit'), width: 40 },
      { header: t('pdf.length'), width: CONTENT_WIDTH - 160, align: 'right' },
    ],
    doc.segments.map((s) => {
      const from = doc.nodes.find((n) => n.id === s.fromNodeId);
      const riser = analysis.routing.ctx.isRiser(s);
      return [
        segmentNo.get(s.id)!,
        `${from?.label || '?'} – ${nodeLabel(s.toNodeId)}`,
        floorName(from?.floorId),
        riser ? t('pdf.riser') : t(`runElevation.${s.runElevation}`),
        itemName(s.conduitItemId),
        meters(analysis.routing.ctx.segmentLengthMm(s)),
      ];
    }),
  );

  // BOM.
  pdf.newPage();
  pdf.heading(t('pdf.bomTitle'));
  for (const category of bomCategoryOrder) {
    const lines = analysis.bom.filter((l) => l.category === category);
    if (lines.length === 0) continue;
    pdf.heading(t(`bom.categories.${category}`), 11);
    pdf.table(
      [
        { header: t('quote.description'), width: CONTENT_WIDTH - 35 },
        { header: t('quote.quantity'), width: 35, align: 'right' },
      ],
      lines.map((l) => [
        describeBomLine(l, lookup, t, locale),
        `${formatNumber(l.quantity, locale)} ${t(`bom.units.${l.unit}`)}`,
      ]),
    );
  }

  // Warnings.
  pdf.heading(t('pdf.warningsTitle'));
  if (analysis.warnings.length === 0) pdf.lines([t('editor.empty.warnings')]);
  for (const id of checkOrder) {
    const list = analysis.warnings.filter((w) => w.id === id);
    if (list.length === 0) continue;
    pdf.lines([`${t(`checks.titles.${id}`)} (${list.length})`]);
    pdf.lines(
      list.map((w) => `• ${describeWarning(w, doc, t, locale)}`),
      PAGE.margin + 4,
      CONTENT_WIDTH - 4,
    );
  }
  return pdf;
}

function drawFloor(
  pdf: PdfWriter,
  { doc, analysis, backgrounds, t }: ProjectPdfInput,
  floor: Floor,
  segmentNo: Map<string, string>,
) {
  pdf.newPage();
  pdf.heading(t('pdf.floorTitle', { name: floor.name }));
  const nodes = doc.nodes.filter((n) => n.floorId === floor.id);
  const ids = new Set(nodes.map((n) => n.id));
  const position = new Map(nodes.map((n) => [n.id, n.position]));
  // Risers join two floors: only their riser points appear on each plan.
  const segments = doc.segments.filter(
    (s) => ids.has(s.fromNodeId) && ids.has(s.toNodeId) && !analysis.routing.ctx.isRiser(s),
  );
  const paths = segments.map((s) => ({
    s,
    points: [position.get(s.fromNodeId)!, ...s.vertices, position.get(s.toNodeId)!],
  }));
  const bg = floor.background;
  const image = bg ? backgrounds.get(floor.id) : undefined;
  const points: Point[] = [
    ...nodes.map((n) => n.position),
    ...paths.flatMap((p) => p.points),
    ...floor.walls.flatMap((w) => [w.a, w.b]),
    ...(bg && image ? backgroundCorners(bg) : []),
  ];
  if (points.length === 0) {
    pdf.lines([t('pdf.emptyFloor')]);
    return;
  }
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const area = {
    x: PAGE.margin,
    y: pdf.y + 2,
    w: CONTENT_WIDTH,
    h: PAGE.height - PAGE.margin - pdf.y - 14,
  };
  const k = Math.min(area.w / Math.max(maxX - minX, 1), area.h / Math.max(maxY - minY, 1));
  const ox = area.x + (area.w - (maxX - minX) * k) / 2;
  const oy = area.y + (area.h - (maxY - minY) * k) / 2;
  const page = (p: Point): Point => ({ x: ox + (p.x - minX) * k, y: oy + (p.y - minY) * k });
  const d = pdf.doc;

  if (bg && image) {
    const mpp = backgroundMetersPerPixel(bg);
    const box = rotatedImageBox(
      page(bg.offset),
      bg.widthPx * mpp * k,
      bg.heightPx * mpp * k,
      bg.rotation,
    );
    d.saveGraphicsState();
    d.setGState(new GState({ opacity: Math.min(bg.opacity, 0.6) }));
    d.addImage(
      image.dataUrl,
      imageFormat(image.dataUrl),
      box.x,
      box.y,
      box.w,
      box.h,
      undefined,
      'FAST',
      box.angle,
    );
    d.restoreGraphicsState();
  }

  d.setDrawColor(60);
  for (const w of floor.walls) {
    d.setLineWidth(Math.max(0.3, w.thickness * k));
    const a = page(w.a);
    const b = page(w.b);
    d.line(a.x, a.y, b.x, b.y);
  }

  d.setLineWidth(0.5);
  d.setFontSize(7);
  for (const { s, points: pts } of paths) {
    d.setDrawColor(...RUN_COLORS[s.runElevation]);
    const onPage = pts.map(page);
    for (let i = 1; i < onPage.length; i++) {
      d.line(onPage[i - 1]!.x, onPage[i - 1]!.y, onPage[i]!.x, onPage[i]!.y);
    }
    const mid = pointAlong(pts, polylineLength(pts) / 2);
    const m = page(mid);
    d.setTextColor(...RUN_COLORS[s.runElevation]);
    d.text(segmentNo.get(s.id)!, m.x + 1, m.y - 1);
  }
  d.setTextColor(0);

  d.setDrawColor(30);
  d.setFillColor(255, 255, 255);
  for (const n of nodes) {
    const p = page(n.position);
    if (n.kind === 'panel') d.rect(p.x - 2, p.y - 1.5, 4, 3, 'FD');
    else if (n.kind === 'junction_box') d.rect(p.x - 1.3, p.y - 1.3, 2.6, 2.6, 'FD');
    else d.circle(p.x, p.y, 1.3, 'FD');
    if (n.label) d.text(n.label, p.x + 2, p.y + 3);
  }

  // Legend.
  d.setFontSize(8);
  let lx = PAGE.margin;
  const ly = PAGE.height - PAGE.margin - 2;
  for (const run of ['floor', 'ceiling', 'direct'] as const) {
    d.setDrawColor(...RUN_COLORS[run]);
    d.line(lx, ly - 1, lx + 6, ly - 1);
    d.text(t(`runElevation.${run}`), lx + 8, ly);
    lx += 50;
  }
  d.setFontSize(10);
  d.setLineWidth(0.2);
  d.setDrawColor(0);
}

function pointAlong(points: readonly Point[], distance: number): Point {
  let left = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= left && len > 0) {
      const f = left / len;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    left -= len;
  }
  return points[points.length - 1]!;
}
