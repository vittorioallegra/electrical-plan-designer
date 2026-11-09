// Structural edits shared by editor commands (mutate `doc`; safe on an immer draft).
import type { IdGenerator } from './ids';
import { rebuildRisers } from './risers';
import { withColumns } from './stacks';
import type { ConduitSegment, PlanNode, Point, ProjectDoc } from './types';

export interface CascadeSummary {
  nodeIds: string[];
  segmentIds: string[];
  extraRunIds: string[];
  panelIds: string[];
  /** Circuits whose targets, manual route or protecting device are affected. */
  circuitIds: string[];
}

const usesSegments = (routing: ProjectDoc['circuits'][number]['routing'], ids: Set<string>) =>
  routing.mode === 'manual' && routing.segmentIds.some((id) => ids.has(id));

/** What deleting these nodes and segments would remove or break (for the confirm dialog). */
export function cascadeOf(
  doc: ProjectDoc,
  nodeIds: string[],
  segmentIds: string[] = [],
): CascadeSummary {
  const nodes = new Set(nodeIds);
  const segments = new Set(segmentIds);
  for (const s of doc.segments) {
    if (nodes.has(s.fromNodeId) || nodes.has(s.toNodeId)) segments.add(s.id);
  }
  const panels = doc.panels.filter((p) => nodes.has(p.nodeId));
  const deviceIds = new Set(panels.flatMap((p) => p.devices.map((d) => d.id)));
  const extraRunIds = doc.extraRuns
    .filter((r) => nodes.has(r.fromNodeId) || nodes.has(r.toNodeId))
    .map((r) => r.id);
  const circuitIds = doc.circuits
    .filter(
      (c) =>
        c.targetNodeIds.some((t) => nodes.has(t)) ||
        usesSegments(c.routing, segments) ||
        deviceIds.has(c.panelDeviceId),
    )
    .map((c) => c.id);
  return {
    nodeIds: [...nodes],
    segmentIds: [...segments],
    extraRunIds,
    panelIds: panels.map((p) => p.id),
    circuitIds,
  };
}

/**
 * Deletes nodes (with their segments, extra runs and panels) and segments. Circuits lose
 * deleted targets; manual routes keep the dangling ids so they show as invalid (never a
 * silent fallback to auto); circuits of a deleted panel stay, unprotected.
 */
export function deleteElements(
  doc: ProjectDoc,
  nodeIds: string[],
  segmentIds: string[],
  genId: IdGenerator,
): CascadeSummary {
  const summary = cascadeOf(doc, nodeIds, segmentIds);
  const nodes = new Set(summary.nodeIds);
  const segments = new Set(summary.segmentIds);
  doc.nodes = doc.nodes.filter((n) => !nodes.has(n.id));
  doc.segments = doc.segments.filter((s) => !segments.has(s.id));
  doc.extraRuns = doc.extraRuns.filter((r) => !summary.extraRunIds.includes(r.id));
  doc.panels = doc.panels.filter((p) => !summary.panelIds.includes(p.id));
  for (const c of doc.circuits) c.targetNodeIds = c.targetNodeIds.filter((t) => !nodes.has(t));
  rebuildRisers(doc, genId);
  return summary;
}

export function deleteFloor(doc: ProjectDoc, floorId: string, genId: IdGenerator): CascadeSummary {
  const summary = deleteElements(
    doc,
    doc.nodes.filter((n) => n.floorId === floorId).map((n) => n.id),
    [],
    genId,
  );
  doc.floors = doc.floors.filter((f) => f.id !== floorId);
  renumberFloors(doc);
  rebuildRisers(doc, genId);
  return summary;
}

/** Moves a floor to `toIndex` in the order (0 = lowest) and rebuilds risers. */
export function moveFloor(
  doc: ProjectDoc,
  floorId: string,
  toIndex: number,
  genId: IdGenerator,
): string[] {
  const sorted = [...doc.floors].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((f) => f.id === floorId);
  if (from < 0) return [];
  const [floor] = sorted.splice(from, 1);
  sorted.splice(Math.max(0, Math.min(toIndex, sorted.length)), 0, floor!);
  const rank = new Map(sorted.map((f, i) => [f.id, i]));
  for (const f of doc.floors) f.order = rank.get(f.id)!;
  return rebuildRisers(doc, genId);
}

function renumberFloors(doc: ProjectDoc): void {
  [...doc.floors]
    .sort((a, b) => a.order - b.order)
    .forEach((f, i) => {
      doc.floors.find((x) => x.id === f.id)!.order = i;
    });
}

/**
 * Moves nodes, each with its whole column; vertices of segments with both ends moved follow
 * along.
 */
export function moveNodes(doc: ProjectDoc, nodeIds: string[], delta: Point): void {
  const ids = new Set(withColumns(doc, nodeIds));
  for (const n of doc.nodes) {
    if (ids.has(n.id)) n.position = { x: n.position.x + delta.x, y: n.position.y + delta.y };
  }
  for (const s of doc.segments) {
    if (ids.has(s.fromNodeId) && ids.has(s.toNodeId)) {
      s.vertices = s.vertices.map((v) => ({ x: v.x + delta.x, y: v.y + delta.y }));
    }
  }
}

export interface Clipboard {
  nodes: PlanNode[];
  segments: ConduitSegment[];
}

/** Copies nodes (panels excluded) and the segments between them. */
export function copyNodes(doc: ProjectDoc, nodeIds: string[]): Clipboard {
  const ids = new Set(nodeIds);
  const nodes = doc.nodes.filter((n) => ids.has(n.id) && n.kind !== 'panel');
  const kept = new Set(nodes.map((n) => n.id));
  return structuredClone({
    nodes,
    segments: doc.segments.filter((s) => kept.has(s.fromNodeId) && kept.has(s.toNodeId)),
  });
}

/**
 * Pastes a clipboard onto `floorId` shifted by `offset`, with new ids. Pasted riser points
 * get a new riserGroupId (unlinked) and pasted columns a new stackId (a box pasted without the
 * rest of its column becomes a column of one, which rebuildStacks dissolves). Returns the new
 * node ids.
 */
export function pasteNodes(
  doc: ProjectDoc,
  clipboard: Clipboard,
  floorId: string,
  offset: Point,
  genId: IdGenerator,
): string[] {
  const idMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  const stackMap = new Map<string, string>();
  const created: string[] = [];
  for (const n of clipboard.nodes) {
    const id = genId();
    idMap.set(n.id, id);
    created.push(id);
    const copy: PlanNode = {
      ...structuredClone(n),
      id,
      floorId,
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
    };
    if (copy.riserGroupId !== undefined) {
      const group = groupMap.get(copy.riserGroupId) ?? genId();
      groupMap.set(copy.riserGroupId, group);
      copy.riserGroupId = group;
    }
    if (copy.stackId !== undefined) {
      const stack = stackMap.get(copy.stackId) ?? genId();
      stackMap.set(copy.stackId, stack);
      copy.stackId = stack;
    }
    doc.nodes.push(copy);
  }
  for (const s of clipboard.segments) {
    doc.segments.push({
      ...structuredClone(s),
      id: genId(),
      fromNodeId: idMap.get(s.fromNodeId)!,
      toNodeId: idMap.get(s.toNodeId)!,
      vertices: s.vertices.map((v) => ({ x: v.x + offset.x, y: v.y + offset.y })),
    });
  }
  return created;
}

/**
 * Links a riser point to the adjacent floor above or below: creates the matching riser point
 * there (same position and group) when the group has none on that floor. Returns its id.
 */
export function linkRiser(
  doc: ProjectDoc,
  nodeId: string,
  direction: 'up' | 'down',
  genId: IdGenerator,
): string | null {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node || node.kind !== 'riser_point') return null;
  const floors = [...doc.floors].sort((a, b) => a.order - b.order);
  const index = floors.findIndex((f) => f.id === node.floorId);
  const target = floors[index + (direction === 'up' ? 1 : -1)];
  if (!target) return null;
  node.riserGroupId ??= genId();
  const existing = doc.nodes.find(
    (n) =>
      n.kind === 'riser_point' && n.floorId === target.id && n.riserGroupId === node.riserGroupId,
  );
  if (existing) return existing.id;
  const id = genId();
  doc.nodes.push({
    id,
    floorId: target.id,
    kind: 'riser_point',
    position: { ...node.position },
    label: node.label,
    status: node.status,
    riserGroupId: node.riserGroupId,
  });
  rebuildRisers(doc, genId);
  return id;
}

/** Detaches a riser point from its group; its riser segments go away. */
export function unlinkRiser(doc: ProjectDoc, nodeId: string, genId: IdGenerator): string[] {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node || node.kind !== 'riser_point') return [];
  node.riserGroupId = genId();
  return rebuildRisers(doc, genId);
}

const labelPrefix: Record<PlanNode['kind'], string> = {
  panel: 'Q',
  junction_box: 'J',
  terminal_box: 'B',
  riser_point: 'R',
};

/** Next free default label for a node kind: Q1, J3, B12, R2. */
export function nextNodeLabel(doc: ProjectDoc, kind: PlanNode['kind']): string {
  const prefix = labelPrefix[kind];
  let max = 0;
  for (const n of doc.nodes) {
    const m = n.kind === kind ? new RegExp(`^${prefix}(\\d+)$`).exec(n.label) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}
