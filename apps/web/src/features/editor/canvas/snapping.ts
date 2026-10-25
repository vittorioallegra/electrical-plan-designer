// Snapping priority: node > vertex > wall end > grid. Tolerance is in screen pixels.
import { distance } from '@epd/domain/geometry';
import type { Point } from '@epd/domain/types';

export type SnapKind = 'node' | 'vertex' | 'wall' | 'grid' | 'none';

export interface SnapTargets {
  nodes: { id: string; position: Point }[];
  vertices: Point[];
  wallEnds: Point[];
}

export interface SnapResult {
  point: Point;
  kind: SnapKind;
  nodeId?: string;
}

export function snapPoint(
  raw: Point,
  targets: SnapTargets,
  options: { scale: number; gridStep: number; enabled: boolean; tolerancePx?: number },
): SnapResult {
  if (!options.enabled) return { point: raw, kind: 'none' };
  const tolerance = (options.tolerancePx ?? 10) / options.scale;
  const nearest = <T>(items: T[], pos: (t: T) => Point) => {
    let best: T | undefined;
    let bestD = tolerance;
    for (const item of items) {
      const d = distance(raw, pos(item));
      if (d <= bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  };
  const node = nearest(targets.nodes, (n) => n.position);
  if (node) return { point: { ...node.position }, kind: 'node', nodeId: node.id };
  const vertex = nearest(targets.vertices, (v) => v);
  if (vertex) return { point: { ...vertex }, kind: 'vertex' };
  const wallEnd = nearest(targets.wallEnds, (v) => v);
  if (wallEnd) return { point: { ...wallEnd }, kind: 'wall' };
  const g = options.gridStep;
  const round = (v: number) => Math.round(Math.round(v / g) * g * 1e6) / 1e6;
  return { point: { x: round(raw.x), y: round(raw.y) }, kind: 'grid' };
}
