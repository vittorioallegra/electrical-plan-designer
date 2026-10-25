// Pure helpers that turn the doc and the UI state into what the canvas draws.
import { UNCALIBRATED_MPP, worldToBackground } from '@epd/domain/geometry';
import type { RoutingResult } from '@epd/domain/routing';
import type {
  ConduitSegment as Segment,
  Floor,
  PlanNode,
  Point,
  ProjectDoc,
} from '@epd/domain/types';
import type { SymbolKind } from '@/components/symbols/symbols';
import type { EditorStore } from '@/stores/editor/editorStore';
import { gridStep, type View } from './viewport';

export const DEFAULT_WALL_THICKNESS = 0.2;
/** Below this zoom (px per meter) length labels are hidden; node labels below half of it. */
export const LABEL_MIN_SCALE = 30;

type UiState = ReturnType<EditorStore['getState']>['ui'];
export type Pick = UiState['pick'];
export type ActiveOwner = UiState['activeOwner'];

export function symbolOf(node: PlanNode): SymbolKind {
  switch (node.kind) {
    case 'panel':
      return 'panel';
    case 'junction_box':
      return 'junction_box';
    case 'riser_point':
      return 'riser';
    case 'terminal_box':
      return node.mounting === 'switch'
        ? 'switch'
        : node.mounting === 'ceiling'
          ? 'ceiling'
          : 'socket';
  }
}

/** Grid lines (meters) covering the visible area. */
export function gridLines(view: View, size: { width: number; height: number }): number[][] {
  const step = gridStep(view.scale);
  const visible = {
    minX: -view.x / view.scale,
    minY: -view.y / view.scale,
    maxX: (size.width - view.x) / view.scale,
    maxY: (size.height - view.y) / view.scale,
  };
  const lines: number[][] = [];
  for (let x = Math.floor(visible.minX / step) * step; x <= visible.maxX; x += step) {
    lines.push([x, visible.minY, x, visible.maxY]);
  }
  for (let y = Math.floor(visible.minY / step) * step; y <= visible.maxY; y += step) {
    lines.push([visible.minX, y, visible.maxX, y]);
  }
  return lines;
}

/** Segments with both ends on the floor. */
export function floorSegmentsOf(
  doc: ProjectDoc,
  nodeById: ReadonlyMap<string, PlanNode>,
  floorId: string,
): Segment[] {
  return doc.segments.filter((s) => {
    const a = nodeById.get(s.fromNodeId);
    const b = nodeById.get(s.toNodeId);
    return a?.floorId === floorId && b?.floorId === floorId;
  });
}

/** Direction of the first leg of every conduit at each node, for label placement. */
export function legsByNode(
  segments: readonly Segment[],
  nodeById: ReadonlyMap<string, PlanNode>,
  posOf: (n: PlanNode) => Point,
): Map<string, Point[]> {
  const legs = new Map<string, Point[]>();
  for (const s of segments) {
    const a = posOf(nodeById.get(s.fromNodeId)!);
    const b = posOf(nodeById.get(s.toNodeId)!);
    const first = s.vertices[0] ?? b;
    const last = s.vertices[s.vertices.length - 1] ?? a;
    legs.set(s.fromNodeId, [
      ...(legs.get(s.fromNodeId) ?? []),
      { x: first.x - a.x, y: first.y - a.y },
    ]);
    legs.set(s.toNodeId, [...(legs.get(s.toNodeId) ?? []), { x: last.x - b.x, y: last.y - b.y }]);
  }
  return legs;
}

/** Riser points with a conduit to another floor. */
export function linkedRisers(
  doc: ProjectDoc,
  nodeById: ReadonlyMap<string, PlanNode>,
): Set<string> {
  return new Set(
    doc.segments
      .filter((s) => nodeById.get(s.fromNodeId)?.floorId !== nodeById.get(s.toNodeId)?.floorId)
      .flatMap((s) => [s.fromNodeId, s.toNodeId]),
  );
}

/**
 * Segments to highlight: the manual route being picked, else the computed route of the active
 * circuit or extra run.
 */
export function highlightedSegments(
  doc: ProjectDoc,
  routing: RoutingResult,
  pick: Pick,
  activeOwner: ActiveOwner,
): Set<string> {
  if (pick?.mode === 'route') {
    const owner =
      pick.owner.kind === 'circuit'
        ? doc.circuits.find((c) => c.id === pick.owner.id)
        : doc.extraRuns.find((r) => r.id === pick.owner.id);
    return new Set(owner?.routing.mode === 'manual' ? owner.routing.segmentIds : []);
  }
  const route = activeOwner
    ? activeOwner.kind === 'circuit'
      ? routing.circuitRoutes.get(activeOwner.id)
      : routing.extraRunRoutes.get(activeOwner.id)
    : undefined;
  return new Set(route?.ok ? route.segmentIds : []);
}

/** Target nodes of the active circuit, or both ends of the active extra run. */
export function activeTargetNodes(doc: ProjectDoc, activeOwner: ActiveOwner): Set<string> {
  if (!activeOwner) return new Set();
  if (activeOwner.kind === 'circuit') {
    return new Set(doc.circuits.find((c) => c.id === activeOwner.id)?.targetNodeIds ?? []);
  }
  const run = doc.extraRuns.find((x) => x.id === activeOwner.id);
  return new Set(run ? [run.fromNodeId, run.toNodeId] : []);
}

export function toBackgroundPx(floor: Floor, world: Point): Point {
  const bg = floor.background!;
  const withCalibration = bg.calibration
    ? bg
    : {
        ...bg,
        calibration: { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, realDistance: UNCALIBRATED_MPP },
      };
  return worldToBackground(withCalibration, world)!;
}

export function backgroundPxToWorld(
  bg: NonNullable<Floor['background']>,
  p: Point,
  mpp: number,
): Point {
  const rad = (bg.rotation * Math.PI) / 180;
  const x = p.x * mpp;
  const y = p.y * mpp;
  return {
    x: bg.offset.x + x * Math.cos(rad) - y * Math.sin(rad),
    y: bg.offset.y + x * Math.sin(rad) + y * Math.cos(rad),
  };
}
