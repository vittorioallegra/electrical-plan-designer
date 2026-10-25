// Editor commands for plan elements. Each one is a single undoable applyCommand.
import { DEFAULT_CONDUIT_ID } from '@epd/domain/catalog/builtin';
import {
  cascadeOf,
  copyNodes,
  deleteElements,
  moveNodes,
  nextNodeLabel,
  pasteNodes,
  type CascadeSummary,
  type Clipboard,
} from '@epd/domain/edits';
import { distance, projectOnPolyline } from '@epd/domain/geometry';
import { newId } from '@epd/domain/ids';
import { splitSegment } from '@epd/domain/routing';
import type { BoxPreset, NodeKind, PlanNode, Point, ProjectDoc } from '@epd/domain/types';
import type { EditorStore } from '@/state/editorStore';
import { segmentPolyline } from './canvas/hitTest';

export const DEFAULT_TERMINAL_BOX_ID = 'builtin:box_503';
export const DEFAULT_JUNCTION_BOX_ID = 'builtin:junction_box_92x92';
export const DEFAULT_ENCLOSURE_ID = 'builtin:enclosure_12m';

export function createNode(
  doc: ProjectDoc,
  kind: NodeKind,
  floorId: string,
  position: Point,
): PlanNode {
  const base: PlanNode = {
    id: newId(),
    floorId,
    kind,
    position: { ...position },
    label: nextNodeLabel(doc, kind),
    status: 'active',
  };
  switch (kind) {
    case 'terminal_box':
      return { ...base, mounting: 'socket', boxItemId: DEFAULT_TERMINAL_BOX_ID, contents: [] };
    case 'junction_box':
      return { ...base, boxItemId: DEFAULT_JUNCTION_BOX_ID };
    case 'riser_point':
      return { ...base, riserGroupId: newId() };
    case 'panel':
      return base;
  }
}

/** Places a node; a junction box dropped on a segment splits it. Returns the node id. */
export function placeNode(
  store: EditorStore,
  kind: NodeKind,
  position: Point,
  onSegmentId?: string,
  preset?: BoxPreset,
): string | null {
  const s = store.getState();
  const floorId = s.ui.floorId;
  if (kind === 'panel' && s.data.doc.panels.length > 0) return null;
  const node = createNode(s.data.doc, kind, floorId, position);
  if (kind === 'terminal_box' && preset) applyPresetTo(node, preset);
  const result = s.applyCommand(`place ${kind}`, (d) => {
    if (kind === 'junction_box' && onSegmentId) {
      const line = segmentPolyline(d.doc, onSegmentId);
      if (line) {
        const hit = projectOnPolyline(line, position);
        node.position = hit.point;
        splitSegment(d.doc, onSegmentId, node, hit.edgeIndex, [newId(), newId()]);
        return;
      }
    }
    d.doc.nodes.push(node);
    if (kind === 'panel') {
      d.doc.panels.push({
        id: newId(),
        nodeId: node.id,
        enclosureItemId: DEFAULT_ENCLOSURE_ID,
        dinRails: 1,
        modulesPerRail: 12,
        devices: [],
      });
    }
  });
  if (!result.ok) return null;
  s.setUi({ selection: [node.id] });
  return node.id;
}

export function addConduit(
  store: EditorStore,
  fromNodeId: string,
  toNodeId: string,
  vertices: Point[],
): string | null {
  const s = store.getState();
  const id = newId();
  const result = s.applyCommand('draw conduit', (d) => {
    d.doc.segments.push({
      id,
      fromNodeId,
      toNodeId,
      vertices,
      conduitItemId: DEFAULT_CONDUIT_ID,
      runElevation: d.settings.defaultRunElevation,
    });
  });
  return result.ok ? id : null;
}

/** Ends a conduit on empty space: a junction box at the last vertex closes the run. */
export function addConduitToNewJunction(
  store: EditorStore,
  fromNodeId: string,
  vertices: Point[],
): string | null {
  const end = vertices[vertices.length - 1];
  if (!end) return null;
  const s = store.getState();
  const node = createNode(s.data.doc, 'junction_box', s.ui.floorId, end);
  const result = s.applyCommand('draw conduit to new junction box', (d) => {
    d.doc.nodes.push(node);
    d.doc.segments.push({
      id: newId(),
      fromNodeId,
      toNodeId: node.id,
      vertices: vertices.slice(0, -1),
      conduitItemId: DEFAULT_CONDUIT_ID,
      runElevation: d.settings.defaultRunElevation,
    });
  });
  return result.ok ? node.id : null;
}

/**
 * What deleting a mixed selection would remove: segment ids count as segments, every other
 * id (nodes, walls) as an element.
 */
export function cascadeOfSelection(doc: ProjectDoc, ids: string[]): CascadeSummary {
  const segmentIds = new Set(doc.segments.map((x) => x.id));
  return cascadeOf(
    doc,
    ids.filter((id) => !segmentIds.has(id)),
    ids.filter((id) => segmentIds.has(id)),
  );
}

/** Deletes plan elements of any kind (nodes, segments, walls) in one undoable step. */
export function deleteIds(store: EditorStore, ids: string[]): void {
  const s = store.getState();
  const set = new Set(ids);
  const doc = s.data.doc;
  const nodeIds = doc.nodes.filter((n) => set.has(n.id)).map((n) => n.id);
  const segmentIds = doc.segments.filter((x) => set.has(x.id)).map((x) => x.id);
  s.applyCommand('delete', (d) => {
    for (const f of d.doc.floors) f.walls = f.walls.filter((w) => !set.has(w.id));
    deleteElements(d.doc, nodeIds, segmentIds, newId);
  });
  store.getState().setUi({ selection: [] });
}

export function moveSelection(
  store: EditorStore,
  nodeIds: string[],
  delta: Point,
  duplicate: boolean,
) {
  const s = store.getState();
  if (duplicate) {
    const clip = copyNodes(s.data.doc, nodeIds);
    let created: string[] = [];
    s.applyCommand('duplicate', (d) => {
      created = pasteNodes(d.doc, clip, s.ui.floorId, delta, newId);
    });
    store.getState().setUi({ selection: created });
    return;
  }
  s.applyCommand('move', (d) => moveNodes(d.doc, nodeIds, delta));
}

let clipboard: Clipboard | null = null;

export function copySelection(store: EditorStore): number {
  const s = store.getState();
  clipboard = copyNodes(s.data.doc, s.ui.selection);
  return clipboard.nodes.length;
}

export function pasteClipboard(store: EditorStore, offset: Point = { x: 0.5, y: 0.5 }): string[] {
  if (!clipboard || clipboard.nodes.length === 0) return [];
  const clip = clipboard;
  const s = store.getState();
  let created: string[] = [];
  s.applyCommand('paste', (d) => {
    created = pasteNodes(d.doc, clip, s.ui.floorId, offset, newId);
  });
  store.getState().setUi({ selection: created });
  return created;
}

/** True when `p` is within `tolerance` of a node on the floor (no stacking boxes). */
export function nodeAt(
  doc: ProjectDoc,
  floorId: string,
  p: Point,
  tolerance: number,
): PlanNode | undefined {
  return doc.nodes.find((n) => n.floorId === floorId && distance(n.position, p) <= tolerance);
}

export function applyPresetTo(node: PlanNode, preset: BoxPreset): void {
  if (preset.mounting) node.mounting = preset.mounting;
  if (preset.boxItemId) node.boxItemId = preset.boxItemId;
  else delete node.boxItemId;
  node.contents = structuredClone(preset.contents);
}
