// Box columns: boxes on one floor sharing a stackId sit at one plan point, one above the other.
// Their vertical conduits are derived: one 'direct' segment between each pair of neighbours by
// height, so its length is the height difference (lengths.ts) and routing and the BOM need
// nothing else.
import { DEFAULT_CONDUIT_ID } from './catalog/builtin';
import type { IdGenerator } from './ids';
import { createLengthContext } from './lengths';
import type { NodeKind, PlanNode, Point, ProjectDoc, ProjectSettings } from './types';

/** Node kinds that can be part of a column. */
export function isStackable(kind: NodeKind): boolean {
  return kind === 'junction_box' || kind === 'terminal_box';
}

/** Ids of the column `nodeId` belongs to (itself included); just `[nodeId]` outside a column. */
export function columnIds(doc: ProjectDoc, nodeId: string): string[] {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node?.stackId) return [nodeId];
  return doc.nodes.filter((n) => n.stackId === node.stackId).map((n) => n.id);
}

/** `nodeIds` with every column they touch completed. */
export function withColumns(doc: ProjectDoc, nodeIds: Iterable<string>): string[] {
  const ids = new Set<string>();
  for (const id of nodeIds) for (const member of columnIds(doc, id)) ids.add(member);
  return [...ids];
}

/** Members of a column, top to bottom (by height; equal heights by id). */
export function columnMembers(
  doc: ProjectDoc,
  settings: ProjectSettings,
  stackId: string,
): PlanNode[] {
  const ctx = createLengthContext(doc, settings);
  return doc.nodes
    .filter((n) => n.stackId === stackId)
    .sort(
      (a, b) =>
        ctx.nodeHeightMm(b.id) - ctx.nodeHeightMm(a.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** True for a segment between two boxes of the same column (a derived vertical conduit). */
export function isColumnSegment(
  doc: ProjectDoc,
  segment: { fromNodeId: string; toNodeId: string },
): boolean {
  const a = doc.nodes.find((n) => n.id === segment.fromNodeId);
  const b = doc.nodes.find((n) => n.id === segment.toNodeId);
  return !!a?.stackId && a.stackId === b?.stackId;
}

/**
 * Gives boxes that share a floor and a plan point one stackId (they are one column however they
 * got there: placed, dragged, typed coordinates, pasted, or an older file). Columns that meet
 * merge. Touches nothing when they already match.
 */
function joinCoincidentBoxes(doc: ProjectDoc, genId: IdGenerator): void {
  const atPoint = new Map<string, PlanNode[]>();
  for (const n of doc.nodes) {
    if (!isStackable(n.kind)) continue;
    const key = `${n.floorId}|${n.position.x}|${n.position.y}`;
    atPoint.set(key, [...(atPoint.get(key) ?? []), n]);
  }
  for (const members of atPoint.values()) {
    if (members.length < 2) continue;
    const existing = members
      .map((n) => n.stackId)
      .filter((id): id is string => id !== undefined)
      .sort();
    const stackId = existing[0] ?? genId();
    for (const n of members) if (n.stackId !== stackId) n.stackId = stackId;
  }
}

/**
 * Brings columns and their vertical conduits in line with the boxes (mutates `doc`, draft-safe):
 * joins boxes at the same point into one column, drops `stackId` from non-boxes and from a
 * column left with one box, and keeps exactly one
 * segment between each pair of neighbours (by height), `direct` with no vertices. A column's
 * conduit item is kept. Touches nothing when the doc is already consistent. Returns the removed
 * segment ids (manual routes through them become invalid).
 */
export function rebuildStacks(
  doc: ProjectDoc,
  settings: ProjectSettings,
  genId: IdGenerator,
): string[] {
  joinCoincidentBoxes(doc, genId);
  const groups = new Map<string, PlanNode[]>();
  for (const n of doc.nodes) {
    if (n.stackId === undefined) continue;
    if (!isStackable(n.kind)) {
      delete n.stackId;
      continue;
    }
    groups.set(n.stackId, [...(groups.get(n.stackId) ?? []), n]);
  }
  for (const [stackId, members] of groups) {
    if (members.length > 1) continue;
    delete members[0]!.stackId;
    groups.delete(stackId);
  }

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const wanted = new Map<string, { upper: string; lower: string; stackId: string }>();
  for (const stackId of groups.keys()) {
    const ordered = columnMembers(doc, settings, stackId);
    for (let i = 1; i < ordered.length; i++) {
      const upper = ordered[i - 1]!.id;
      const lower = ordered[i]!.id;
      wanted.set(pairKey(upper, lower), { upper, lower, stackId });
    }
  }

  const stackOf = new Map(doc.nodes.map((n) => [n.id, n.stackId]));
  const conduitByStack = new Map<string, string>();
  const kept = new Set<string>();
  const removed: string[] = [];
  const segments = doc.segments.filter((s) => {
    const stack = stackOf.get(s.fromNodeId);
    if (stack === undefined || stack !== stackOf.get(s.toNodeId)) return true;
    conduitByStack.set(stack, s.conduitItemId);
    const key = pairKey(s.fromNodeId, s.toNodeId);
    if (wanted.has(key) && !kept.has(key)) {
      kept.add(key);
      if (s.runElevation !== 'direct') s.runElevation = 'direct';
      if (s.vertices.length > 0) s.vertices = [];
      return true;
    }
    removed.push(s.id);
    return false;
  });
  if (removed.length > 0) doc.segments = segments;

  for (const [key, { upper, lower, stackId }] of wanted) {
    if (kept.has(key)) continue;
    doc.segments.push({
      id: genId(),
      fromNodeId: upper,
      toNodeId: lower,
      vertices: [],
      conduitItemId: conduitByStack.get(stackId) ?? DEFAULT_CONDUIT_ID,
      runElevation: 'direct',
    });
  }
  return removed;
}

/** Adds `node` to the column of `targetId` (creating it), at the target's floor and point. */
export function addToColumn(
  doc: ProjectDoc,
  targetId: string,
  node: PlanNode,
  genId: IdGenerator,
): boolean {
  const target = doc.nodes.find((n) => n.id === targetId);
  if (!target || !isStackable(target.kind) || !isStackable(node.kind)) return false;
  target.stackId ??= genId();
  node.stackId = target.stackId;
  node.floorId = target.floorId;
  node.position = { ...target.position };
  doc.nodes.push(node);
  return true;
}

/** Takes a box out of its column and moves it by `offset`; its conduits stay attached. */
export function takeOutOfColumn(doc: ProjectDoc, nodeId: string, offset: Point): boolean {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node?.stackId) return false;
  delete node.stackId;
  node.position = { x: node.position.x + offset.x, y: node.position.y + offset.y };
  return true;
}

/** Boxes of a column at the same height as another member (the vertical conduit is 0 m). */
export function sameHeightColumnNodeIds(doc: ProjectDoc, settings: ProjectSettings): string[] {
  const ctx = createLengthContext(doc, settings);
  const seen = new Map<string, string[]>();
  for (const n of doc.nodes) {
    if (!n.stackId) continue;
    const key = `${n.stackId}|${ctx.nodeHeightMm(n.id)}`;
    seen.set(key, [...(seen.get(key) ?? []), n.id]);
  }
  return [...seen.values()].filter((ids) => ids.length > 1).flat();
}
