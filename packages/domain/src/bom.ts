// Bill of materials computed from the drawing. Never typed by hand.
import type { CatalogLookup } from './catalog/lookup';
import type { CatalogCategory } from './catalog/types';
import { ceilClean, toMm } from './geometry';
import { routeDoc, type RoutingResult } from './routing';
import type { CableColor, ProjectDoc, ProjectSettings } from './types';

export type BomCategory = CatalogCategory | 'missing';

export interface BomLine {
  /** Stable key: the itemId, or `cable:<section>:<color>`. Used by price overrides. */
  key: string;
  category: BomCategory;
  itemId?: string;
  cable?: { crossSection: number; color: CableColor };
  quantity: number;
  unit: 'pcs' | 'm';
}

export const bomCategoryOrder: BomCategory[] = [
  'cable',
  'conduit',
  'box',
  'junction_box',
  'device',
  'blanking_cover',
  'plate',
  'enclosure',
  'panel_device',
  'missing',
];

export function cableLineKey(crossSection: number, color: CableColor): string {
  return `cable:${crossSection}:${color}`;
}

/** Sum in mm × (1 + waste%), then up to the next whole meter. */
export function metersWithWaste(totalMm: number, wastePercent: number): number {
  return ceilClean((totalMm * (100 + wastePercent)) / 100_000);
}

export function computeBom(
  doc: ProjectDoc,
  settings: ProjectSettings,
  catalog: CatalogLookup,
  routing: RoutingResult = routeDoc(doc, settings),
): BomLine[] {
  const lengthOf = new Map(doc.segments.map((s) => [s.id, routing.ctx.segmentLengthMm(s)]));
  const slackMm = toMm(settings.terminationSlack);

  const cableMm = new Map<string, { crossSection: number; color: CableColor; mm: number }>();
  for (const [segmentId, conductors] of routing.occupancy) {
    const perConductor = (lengthOf.get(segmentId) ?? 0) + 2 * slackMm;
    for (const c of conductors) {
      const key = cableLineKey(c.crossSection, c.color);
      const entry = cableMm.get(key) ?? { crossSection: c.crossSection, color: c.color, mm: 0 };
      entry.mm += perConductor;
      cableMm.set(key, entry);
    }
  }

  const conduitMm = new Map<string, number>();
  for (const s of doc.segments) {
    conduitMm.set(
      s.conduitItemId,
      (conduitMm.get(s.conduitItemId) ?? 0) + (lengthOf.get(s.id) ?? 0),
    );
  }

  const pieces = new Map<string, number>();
  const addPieces = (itemId: string | undefined, qty = 1) => {
    if (itemId !== undefined) pieces.set(itemId, (pieces.get(itemId) ?? 0) + qty);
  };
  for (const n of doc.nodes) {
    addPieces(n.boxItemId);
    for (const c of n.contents ?? []) addPieces(c.itemId, c.qty);
  }
  for (const p of doc.panels) {
    addPieces(p.enclosureItemId);
    for (const d of p.devices) addPieces(d.itemId);
  }

  const lines: BomLine[] = [];
  for (const [key, c] of cableMm) {
    lines.push({
      key,
      category: 'cable',
      cable: { crossSection: c.crossSection, color: c.color },
      quantity: metersWithWaste(c.mm, settings.wastePercent),
      unit: 'm',
    });
  }
  for (const [itemId, mm] of conduitMm) {
    const item = catalog(itemId);
    lines.push({
      key: itemId,
      category: item ? 'conduit' : 'missing',
      itemId,
      quantity: metersWithWaste(mm, settings.wastePercent),
      unit: 'm',
    });
  }
  for (const [itemId, qty] of pieces) {
    const item = catalog(itemId);
    lines.push({
      key: itemId,
      category: item?.category ?? 'missing',
      itemId,
      quantity: qty,
      unit: item?.unit ?? 'pcs',
    });
  }

  const rank = (c: BomCategory) => bomCategoryOrder.indexOf(c);
  return lines.sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      (a.cable && b.cable ? a.cable.crossSection - b.cable.crossSection : 0) ||
      a.key.localeCompare(b.key),
  );
}
