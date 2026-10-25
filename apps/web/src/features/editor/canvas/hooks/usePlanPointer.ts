import type Konva from 'konva';
import { useRef, useState } from 'react';
import { backgroundMetersPerPixel } from '@epd/domain/geometry';
import { newId } from '@epd/domain/ids';
import type { BoxPreset, Floor, PlanNode, Point, ProjectDoc } from '@epd/domain/types';
import {
  addConduit,
  addConduitToNewJunction,
  moveSelection,
  nodeAt,
  placeNode,
} from '@/features/editor/utils/commands';
import type { EditorStore } from '@/stores/editor/editorStore';
import { boxSelect, hitTest, NODE_HIT_PX, type Hit } from '../hitTest';
import { DEFAULT_WALL_THICKNESS, toBackgroundPx, type Pick } from '../planScene';
import { snapPoint, type SnapResult } from '../snapping';
import { screenToWorld, snapStep, zoomAt, type View } from '../viewport';

type PickOwner = { kind: 'circuit' | 'extra'; id: string };

/** Circuit picking edits, injected so the canvas does not depend on the circuits feature. */
export interface CanvasPickHandlers {
  toggleTarget: (store: EditorStore, circuitId: string, nodeId: string) => void;
  toggleRouteSegment: (store: EditorStore, owner: PickOwner, segmentId: string) => void;
}

export type Drag =
  | { kind: 'pan'; start: Point; view: View; moved: boolean }
  | { kind: 'box'; start: Point; current: Point; additive: boolean; moved: boolean }
  | {
      kind: 'move';
      nodeIds: string[];
      start: Point;
      anchor: Point;
      delta: Point;
      duplicate: boolean;
      moved: boolean;
    };

export interface SnapTargets {
  nodes: { id: string; position: Point }[];
  vertices: Point[];
  wallEnds: Point[];
}

export interface PlanPointerInput {
  store: EditorStore;
  view: View;
  tool: string;
  floorId: string;
  floor: Floor | undefined;
  doc: ProjectDoc;
  nodeById: ReadonlyMap<string, PlanNode>;
  snapTargets: SnapTargets;
  pick: Pick;
  pickHandlers: CanvasPickHandlers | undefined;
  boxPreset: BoxPreset | undefined;
  onCalibrationPoints: (p1: Point, p2: Point) => void;
}

function pointerScreen(e: Konva.KonvaEventObject<MouseEvent | WheelEvent>): Point | null {
  return e.target.getStage()?.getPointerPosition() ?? null;
}

/**
 * Mouse handling of the plan: pan, zoom, box select, drag to move or duplicate, picking, and
 * the drawing tools (wall chain, calibration points, conduit with vertices, node placement).
 * Returns the stage handlers and the in-progress state the overlay draws.
 */
export function usePlanPointer(input: PlanPointerInput) {
  const { store, view, tool, floorId, floor, doc, nodeById, snapTargets, pick } = input;
  const [cursor, setCursor] = useState<SnapResult | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [calibration, setCalibration] = useState<Point[]>([]);
  const [conduit, setConduit] = useState<{ fromNodeId: string; vertices: Point[] } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);
  const lastHits = useRef<{ hits: Hit[]; index: number } | null>(null);

  // Tool switches and floor switches reset the in-progress action.
  const actionKey = `${tool}|${floorId}`;
  const [lastActionKey, setLastActionKey] = useState(actionKey);
  if (lastActionKey !== actionKey) {
    setLastActionKey(actionKey);
    setWallStart(null);
    setCalibration([]);
    setConduit(null);
  }

  function snapped(raw: Point, alt: boolean): SnapResult {
    return snapPoint(raw, snapTargets, {
      scale: view.scale,
      gridStep: snapStep(view.scale),
      enabled: !alt,
    });
  }

  function select(ids: string[]) {
    store.getState().setUi({ selection: ids });
  }

  function finishConduitAtVertex() {
    if (!conduit || conduit.vertices.length === 0) return;
    const jb = addConduitToNewJunction(store, conduit.fromNodeId, conduit.vertices);
    setConduit(jb ? { fromNodeId: jb, vertices: [] } : null);
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const p = pointerScreen(e);
    if (!p) return;
    store.getState().setUi({ view: zoomAt(view, p, Math.pow(1.0015, -e.evt.deltaY)) });
  }

  function onMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const p = pointerScreen(e);
    if (!p) return;
    const world = screenToWorld(view, p);
    if (e.evt.button === 1) {
      setDrag({ kind: 'pan', start: p, view, moved: false });
      return;
    }
    if (e.evt.button !== 0 || tool !== 'select') return;
    const hits = hitTest(doc, floorId, world, view.scale);
    const top = hits[0];
    if (top?.kind === 'node' && !store.getState().readOnly) {
      const current = store.getState().ui.selection;
      const nodeIds = current.includes(top.id)
        ? current.filter((id) => nodeById.has(id))
        : [top.id];
      setDrag({
        kind: 'move',
        nodeIds,
        start: world,
        anchor: nodeById.get(top.id)!.position,
        delta: { x: 0, y: 0 },
        duplicate: e.evt.altKey,
        moved: false,
      });
      return;
    }
    if (!top) {
      setDrag(
        e.evt.shiftKey
          ? { kind: 'box', start: world, current: world, additive: true, moved: false }
          : { kind: 'pan', start: p, view, moved: false },
      );
    }
  }

  function onMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const p = pointerScreen(e);
    if (!p) return;
    const world = screenToWorld(view, p);
    if (drag?.kind === 'pan') {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      store.getState().setUi({ view: { ...drag.view, x: drag.view.x + dx, y: drag.view.y + dy } });
      if (!drag.moved && Math.hypot(dx, dy) > 3) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag?.kind === 'box') {
      setDrag({ ...drag, current: world, moved: true });
      return;
    }
    if (drag?.kind === 'move') {
      const raw = {
        x: drag.anchor.x + world.x - drag.start.x,
        y: drag.anchor.y + world.y - drag.start.y,
      };
      const target = snapPoint(
        raw,
        { ...snapTargets, nodes: snapTargets.nodes.filter((n) => !drag.nodeIds.includes(n.id)) },
        {
          scale: view.scale,
          gridStep: snapStep(view.scale),
          enabled: !e.evt.altKey || drag.duplicate,
        },
      ).point;
      const delta = { x: target.x - drag.anchor.x, y: target.y - drag.anchor.y };
      const moved =
        drag.moved || Math.hypot(world.x - drag.start.x, world.y - drag.start.y) * view.scale > 3;
      setDrag({ ...drag, delta, moved });
      return;
    }
    if (tool !== 'select') {
      setCursor(
        tool === 'calibrate' ? { point: world, kind: 'none' } : snapped(world, e.evt.altKey),
      );
    }
  }

  function onMouseUp() {
    if (!drag) return;
    if (drag.moved) suppressClick.current = true;
    if (drag.kind === 'move' && drag.moved && (drag.delta.x !== 0 || drag.delta.y !== 0)) {
      moveSelection(store, drag.nodeIds, drag.delta, drag.duplicate);
      if (!drag.duplicate) select(drag.nodeIds);
    }
    if (drag.kind === 'box' && drag.moved) {
      const ids = boxSelect(doc, floorId, drag.start, drag.current);
      const current = store.getState().ui.selection;
      select(drag.additive ? [...new Set([...current, ...ids])] : ids);
    }
    setDrag(null);
  }

  function onClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const p = pointerScreen(e);
    if (!p) return;
    const world = screenToWorld(view, p);
    const s = store.getState();

    if (pick && !s.readOnly) {
      const { pickHandlers } = input;
      if (!pickHandlers) return;
      const hits = hitTest(doc, floorId, world, view.scale);
      if (pick.mode === 'targets' && pick.owner.kind === 'circuit') {
        const node = hits.find((h) => h.kind === 'node');
        const kind = node ? nodeById.get(node.id)?.kind : undefined;
        if (node && (kind === 'terminal_box' || kind === 'junction_box'))
          pickHandlers.toggleTarget(store, pick.owner.id, node.id);
      } else if (pick.mode === 'route') {
        const segment = hits.find((h) => h.kind === 'segment');
        if (segment) pickHandlers.toggleRouteSegment(store, pick.owner, segment.id);
      }
      return;
    }

    if (tool === 'select') {
      const hits = hitTest(doc, floorId, world, view.scale);
      lastHits.current = { hits, index: 0 };
      const top = hits[0];
      if (!top) {
        if (!e.evt.shiftKey) select([]);
        return;
      }
      if (e.evt.shiftKey) {
        const current = s.ui.selection;
        select(
          current.includes(top.id) ? current.filter((id) => id !== top.id) : [...current, top.id],
        );
      } else {
        select([top.id]);
      }
      return;
    }

    if (s.readOnly) return;
    const snap = snapped(world, e.evt.altKey);

    if (tool === 'wall') {
      const point = snap.point;
      if (!wallStart) {
        setWallStart(point);
        return;
      }
      // Clicking the chain's last point again (a double click) ends the chain. Konva's own
      // dblclick also fires for two quick clicks at different points, so it is not used.
      if (point.x === wallStart.x && point.y === wallStart.y) {
        setWallStart(null);
        return;
      }
      const wall = { id: newId(), a: wallStart, b: point, thickness: DEFAULT_WALL_THICKNESS };
      s.applyCommand('draw wall', (d) => {
        d.doc.floors.find((f) => f.id === floorId)?.walls.push(wall);
      });
      setWallStart(point);
      return;
    }

    if (tool === 'calibrate' && floor?.background) {
      const next = [...calibration, toBackgroundPx(floor, world)];
      if (next.length === 2) {
        setCalibration([]);
        input.onCalibrationPoints(next[0]!, next[1]!);
      } else {
        setCalibration(next);
      }
      return;
    }

    if (tool === 'conduit') {
      const target = snap.kind === 'node' ? snap.nodeId : undefined;
      if (!conduit) {
        if (target) setConduit({ fromNodeId: target, vertices: [] });
        return;
      }
      if (target && target !== conduit.fromNodeId) {
        if (addConduit(store, conduit.fromNodeId, target, conduit.vertices)) {
          setConduit({ fromNodeId: target, vertices: [] });
        }
        return;
      }
      if (target) return;
      const last = conduit.vertices[conduit.vertices.length - 1];
      if (last && last.x === snap.point.x && last.y === snap.point.y) {
        finishConduitAtVertex();
        return;
      }
      setConduit({ ...conduit, vertices: [...conduit.vertices, snap.point] });
      return;
    }

    if (
      tool === 'panel' ||
      tool === 'junction_box' ||
      tool === 'terminal_box' ||
      tool === 'riser_point'
    ) {
      if (snap.kind === 'node' || nodeAt(doc, floorId, snap.point, NODE_HIT_PX / view.scale))
        return;
      const onSegment =
        tool === 'junction_box'
          ? hitTest(doc, floorId, snap.point, view.scale).find((h) => h.kind === 'segment')?.id
          : undefined;
      placeNode(
        store,
        tool,
        snap.point,
        onSegment,
        tool === 'terminal_box' ? input.boxPreset : undefined,
      );
    }
  }

  return {
    /** In-progress state, drawn by the tool overlay. */
    cursor,
    wallStart,
    calibration,
    conduit,
    drag,
    /** Last select-click hits, cycled with Tab. */
    lastHits,
    select,
    finishConduitAtVertex,
    hasAction: Boolean(wallStart || calibration.length > 0 || conduit),
    cancelAction() {
      setWallStart(null);
      setCalibration([]);
      setConduit(null);
    },
    popConduitVertex() {
      if (conduit) setConduit({ ...conduit, vertices: conduit.vertices.slice(0, -1) });
    },
    /** Background meters per pixel (1 without a background). */
    mpp: floor?.background ? backgroundMetersPerPixel(floor.background) : 1,
    handlers: {
      onWheel,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onClick,
      onMouseLeave() {
        setDrag(null);
        setCursor(null);
      },
      onContextMenu(e: Konva.KonvaEventObject<PointerEvent>) {
        e.evt.preventDefault();
        setWallStart(null);
        setConduit(null);
      },
    },
  };
}

export type PlanPointer = ReturnType<typeof usePlanPointer>;
