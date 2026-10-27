// Hit testing in world coordinates, so selection and Tab cycling do not depend on Konva.
import { distance, projectOnPolyline } from '@epd/domain/geometry';
import type { Point, ProjectDoc, Wall } from '@epd/domain/types';
import type { WallEnd } from '@epd/domain/walls';

export type HitKind = 'node' | 'segment' | 'wall';

export interface Hit {
  kind: HitKind;
  id: string;
  distance: number;
}

export const NODE_HIT_PX = 12;
export const SEGMENT_HIT_PX = 6;
/** Smallest radius of the end handles of a selected wall. */
export const WALL_HANDLE_PX = 7;

/** Radius (m) of a wall's end handles: never smaller than the wall is thick. */
export function wallHandleRadius(wall: Wall, scale: number): number {
  return Math.max(WALL_HANDLE_PX / scale, wall.thickness / 2 + 2 / scale);
}

/** Plan polyline of a same-floor segment (risers have none). */
export function segmentPolyline(doc: ProjectDoc, segmentId: string): Point[] | null {
  const s = doc.segments.find((x) => x.id === segmentId);
  if (!s) return null;
  const a = doc.nodes.find((n) => n.id === s.fromNodeId);
  const b = doc.nodes.find((n) => n.id === s.toNodeId);
  if (!a || !b || a.floorId !== b.floorId) return null;
  return [a.position, ...s.vertices, b.position];
}

/** Everything under `p` on a floor, nodes first, then segments, then walls; nearest first. */
export function hitTest(doc: ProjectDoc, floorId: string, p: Point, scale: number): Hit[] {
  const hits: Hit[] = [];
  const nodeIds = new Set<string>();
  for (const n of doc.nodes) {
    if (n.floorId !== floorId) continue;
    nodeIds.add(n.id);
    const d = distance(n.position, p);
    if (d <= NODE_HIT_PX / scale) hits.push({ kind: 'node', id: n.id, distance: d });
  }
  for (const s of doc.segments) {
    if (!nodeIds.has(s.fromNodeId) || !nodeIds.has(s.toNodeId)) continue;
    const line = segmentPolyline(doc, s.id);
    if (!line) continue;
    const d = projectOnPolyline(line, p).distance;
    if (d <= SEGMENT_HIT_PX / scale) hits.push({ kind: 'segment', id: s.id, distance: d });
  }
  for (const w of doc.floors.find((f) => f.id === floorId)?.walls ?? []) {
    const d = projectOnPolyline([w.a, w.b], p).distance;
    if (d <= w.thickness / 2 + 4 / scale) hits.push({ kind: 'wall', id: w.id, distance: d });
  }
  const rank: Record<HitKind, number> = { node: 0, segment: 1, wall: 2 };
  return hits.sort((a, b) => rank[a.kind] - rank[b.kind] || a.distance - b.distance);
}

/** Ids fully inside a world rectangle on a floor (nodes, segments, walls). */
export function boxSelect(doc: ProjectDoc, floorId: string, a: Point, b: Point): string[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const inside = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  const ids: string[] = [];
  for (const n of doc.nodes) if (n.floorId === floorId && inside(n.position)) ids.push(n.id);
  for (const s of doc.segments) {
    const line = segmentPolyline(doc, s.id);
    if (
      line &&
      doc.nodes.find((n) => n.id === s.fromNodeId)?.floorId === floorId &&
      line.every(inside)
    ) {
      ids.push(s.id);
    }
  }
  for (const w of doc.floors.find((f) => f.id === floorId)?.walls ?? []) {
    if (inside(w.a) && inside(w.b)) ids.push(w.id);
  }
  return ids;
}

/** The end handle of a wall under `p`, the nearer one when both are. */
export function wallHandleAt(wall: Wall, p: Point, scale: number): WallEnd | null {
  const da = distance(wall.a, p);
  const db = distance(wall.b, p);
  const reach = wallHandleRadius(wall, scale);
  if (da > reach && db > reach) return null;
  return da <= db ? 'a' : 'b';
}
