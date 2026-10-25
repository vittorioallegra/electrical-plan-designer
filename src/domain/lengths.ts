// Node heights, floor elevations and conduit segment lengths (integer mm).
import { polylineLength, toMm } from './geometry';
import type { ConduitSegment, Floor, PlanNode, ProjectDoc, ProjectSettings } from './types';

export interface LengthContext {
  /** Height of the node above its floor's finished floor, mm (clamped to the floor height). */
  nodeHeightMm(nodeId: string): number;
  /** Elevation of a floor's finished floor above the lowest floor, mm. */
  floorElevationMm(floorId: string): number;
  /** Total segment length including vertical drops or the riser rise, mm. */
  segmentLengthMm(segment: ConduitSegment): number;
  isRiser(segment: ConduitSegment): boolean;
  /** Nodes whose custom/mounting height exceeded the floor height and was clamped. */
  clampedNodeIds: string[];
  /** Riser points whose attached runs mix floor and ceiling elevations. */
  mixedRiserNodeIds: string[];
}

function mountingDefault(node: PlanNode, floor: Floor, settings: ProjectSettings): number {
  const h = settings.mountingHeights;
  switch (node.kind) {
    case 'panel':
      return h.panel;
    case 'junction_box':
      return h.junctionBox;
    case 'terminal_box':
      switch (node.mounting) {
        case 'switch':
          return h.switch;
        case 'ceiling':
          return floor.height;
        case 'socket':
        case 'custom':
        case undefined:
          return h.socket;
      }
      return h.socket;
    case 'riser_point':
      return 0;
  }
}

export function createLengthContext(doc: ProjectDoc, settings: ProjectSettings): LengthContext {
  const floors = new Map(doc.floors.map((f) => [f.id, f]));
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));

  const elevations = new Map<string, number>();
  let running = 0;
  for (const floor of [...doc.floors].sort((a, b) => a.order - b.order)) {
    elevations.set(floor.id, running);
    running += toMm(floor.height);
  }

  const isRiser = (s: ConduitSegment) => {
    const a = nodes.get(s.fromNodeId);
    const b = nodes.get(s.toNodeId);
    return !!a && !!b && a.floorId !== b.floorId;
  };

  // A riser point sits at the elevation of the same-floor runs attached to it.
  const riserRunElevations = new Map<string, Set<'floor' | 'ceiling'>>();
  for (const s of doc.segments) {
    if (isRiser(s)) continue;
    for (const end of [s.fromNodeId, s.toNodeId]) {
      if (nodes.get(end)?.kind !== 'riser_point') continue;
      const set = riserRunElevations.get(end) ?? new Set();
      set.add(s.runElevation === 'ceiling' ? 'ceiling' : 'floor');
      riserRunElevations.set(end, set);
    }
  }

  const clampedNodeIds: string[] = [];
  const mixedRiserNodeIds: string[] = [];
  const heights = new Map<string, number>();
  for (const node of doc.nodes) {
    const floor = floors.get(node.floorId);
    if (!floor) continue;
    const floorMm = toMm(floor.height);
    let mm: number;
    if (node.kind === 'riser_point') {
      const set = riserRunElevations.get(node.id);
      if (set && set.size > 1) mixedRiserNodeIds.push(node.id);
      // Mixed elevations: the floor-level run wins (shorter riser, warned anyway).
      mm = set?.has('ceiling') && !set.has('floor') ? floorMm : 0;
    } else {
      mm = toMm(node.customHeight ?? mountingDefault(node, floor, settings));
      if (mm > floorMm) {
        clampedNodeIds.push(node.id);
        mm = floorMm;
      }
    }
    heights.set(node.id, mm);
  }

  const nodeHeightMm = (id: string) => heights.get(id) ?? 0;
  const floorElevationMm = (id: string) => elevations.get(id) ?? 0;

  function segmentLengthMm(s: ConduitSegment): number {
    const a = nodes.get(s.fromNodeId);
    const b = nodes.get(s.toNodeId);
    if (!a || !b) return 0;
    if (a.floorId !== b.floorId) {
      const top = (n: PlanNode) => floorElevationMm(n.floorId) + nodeHeightMm(n.id);
      return Math.abs(top(a) - top(b));
    }
    const plan = toMm(polylineLength([a.position, ...s.vertices, b.position]));
    const ha = nodeHeightMm(a.id);
    const hb = nodeHeightMm(b.id);
    switch (s.runElevation) {
      case 'floor':
        return plan + ha + hb;
      case 'ceiling': {
        const floorMm = toMm(floors.get(a.floorId)?.height ?? 0);
        return plan + (floorMm - ha) + (floorMm - hb);
      }
      case 'direct':
        return plan + Math.abs(ha - hb);
    }
  }

  return {
    nodeHeightMm,
    floorElevationMm,
    segmentLengthMm,
    isRiser,
    clampedNodeIds,
    mixedRiserNodeIds,
  };
}

/** Lengths of every segment, mm, keyed by segment id. */
export function segmentLengths(doc: ProjectDoc, settings: ProjectSettings): Map<string, number> {
  const ctx = createLengthContext(doc, settings);
  return new Map(doc.segments.map((s) => [s.id, ctx.segmentLengthMm(s)]));
}
