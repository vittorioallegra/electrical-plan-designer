// Structural edits shared by editor commands (mutate `doc`; safe on an immer draft).
import type { IdGenerator } from './ids';
import { rebuildRisers } from './risers';
import type { ProjectDoc } from './types';

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
