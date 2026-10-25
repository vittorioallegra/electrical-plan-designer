import type Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
} from 'react-konva';
import { backgroundMetersPerPixel, UNCALIBRATED_MPP, worldToBackground } from '@/domain/geometry';
import { createLengthContext } from '@/domain/lengths';
import { newId } from '@/domain/ids';
import type { Floor, PlanNode, Point, RunElevation } from '@/domain/types';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import { useCatalog } from '../../catalog/useCatalog';
import { useAnalysis } from '../../bom/useAnalysis';
import { toggleRouteSegment, toggleTarget } from '../../circuits/commands';
import { formatLength } from '@/ui/format';
import { provisionDash, symbolPaths, type SymbolKind } from '@/ui/symbols';
import { addConduit, addConduitToNewJunction, moveSelection, nodeAt, placeNode } from '../commands';
import { boxSelect, hitTest, NODE_HIT_PX, type Hit } from './hitTest';
import { snapPoint, type SnapResult } from './snapping';
import { useBackgroundImage } from './useBackgroundImage';
import { centerOn, gridStep, screenToWorld, snapStep, zoomAt, type View } from './viewport';

export const DEFAULT_WALL_THICKNESS = 0.2;
/** Below this zoom (px per meter) length labels are hidden; node labels below half of it. */
export const LABEL_MIN_SCALE = 30;

const css = (name: string) =>
  typeof document === 'undefined'
    ? '#000'
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

type Drag =
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

export interface PlanCanvasProps {
  onCalibrationPoints: (p1: Point, p2: Point) => void;
  onDeleteRequest: (ids: string[]) => void;
}

/** The plan canvas: background, grid, walls, conduits, nodes and the active tool (meters). */
export function PlanCanvas({ onCalibrationPoints, onDeleteRequest }: PlanCanvasProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const view = useEditor((s) => s.ui.view);
  const tool = useEditor((s) => s.ui.tool);
  const floorId = useEditor((s) => s.ui.floorId);
  const selection = useEditor((s) => s.ui.selection);
  const doc = useEditor((s) => s.data.doc);
  const settings = useEditor((s) => s.data.settings);
  const floor = doc.floors.find((f) => f.id === floorId);
  const { image } = useBackgroundImage(floor?.background?.storagePath);
  const { profile } = useCatalog();
  const presetId = useEditor((s) => s.ui.presetId);
  const pick = useEditor((s) => s.ui.pick);
  const activeOwner = useEditor((s) => s.ui.activeOwner);
  const { routing } = useAnalysis();

  const [cursor, setCursor] = useState<SnapResult | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [calibration, setCalibration] = useState<Point[]>([]);
  const [conduit, setConduit] = useState<{ fromNodeId: string; vertices: Point[] } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);
  const lastHits = useRef<{ hits: Hit[]; index: number } | null>(null);

  const colors = useMemo(
    () => ({
      grid: css('--color-canvas-grid'),
      wall: css('--color-canvas-wall'),
      node: css('--color-canvas-node'),
      selection: css('--color-canvas-selection'),
      highlight: css('--color-canvas-highlight'),
      riser: css('--color-canvas-riser'),
      run: {
        floor: css('--color-canvas-run-floor'),
        ceiling: css('--color-canvas-run-ceiling'),
        direct: css('--color-canvas-run-direct'),
      } satisfies Record<RunElevation, string>,
    }),
    [],
  );

  useEffect(() => {
    const el = container.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A focus request (e.g. from the warnings tab) pans the view to that point once.
  const focus = useEditor((s) => s.ui.focus);
  useEffect(() => {
    if (!focus) return;
    const state = store.getState();
    state.setUi({ view: centerOn(state.ui.view, focus, size), focus: null });
  }, [focus, size, store]);

  // Tool switches and floor switches reset the in-progress action.
  const actionKey = `${tool}|${floorId}`;
  const [lastActionKey, setLastActionKey] = useState(actionKey);
  if (lastActionKey !== actionKey) {
    setLastActionKey(actionKey);
    setWallStart(null);
    setCalibration([]);
    setConduit(null);
  }

  const lengths = useMemo(() => createLengthContext(doc, settings), [doc, settings]);
  const floorNodes = useMemo(() => doc.nodes.filter((n) => n.floorId === floorId), [doc, floorId]);
  const nodeById = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc]);

  const snapTargets = useMemo(() => {
    const ids = new Set(floorNodes.map((n) => n.id));
    return {
      nodes: floorNodes.map((n) => ({ id: n.id, position: n.position })),
      vertices: doc.segments.filter((s) => ids.has(s.fromNodeId)).flatMap((s) => s.vertices),
      wallEnds: (floor?.walls ?? []).flatMap((w) => [w.a, w.b]),
    };
  }, [floorNodes, doc.segments, floor]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      if (e.key === 'Escape') {
        if (store.getState().ui.pick) {
          store.getState().setUi({ pick: null });
          return;
        }
        if (wallStart || calibration.length > 0 || conduit) {
          setWallStart(null);
          setCalibration([]);
          setConduit(null);
        } else {
          store.getState().setUi({ tool: 'select', selection: [] });
        }
        return;
      }
      if (tool === 'conduit' && conduit) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          setConduit({ ...conduit, vertices: conduit.vertices.slice(0, -1) });
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          finishConduitAtVertex();
          return;
        }
      }
      if (e.key === 'Tab' && lastHits.current && lastHits.current.hits.length > 1) {
        e.preventDefault();
        const next = (lastHits.current.index + 1) % lastHits.current.hits.length;
        lastHits.current.index = next;
        select([lastHits.current.hits[next]!.id]);
        return;
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        store.getState().ui.selection.length > 0
      ) {
        e.preventDefault();
        onDeleteRequest(store.getState().ui.selection);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function pointerScreen(e: Konva.KonvaEventObject<MouseEvent | WheelEvent>): Point | null {
    return e.target.getStage()?.getPointerPosition() ?? null;
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
      const hits = hitTest(doc, floorId, world, view.scale);
      if (pick.mode === 'targets' && pick.owner.kind === 'circuit') {
        const node = hits.find((h) => h.kind === 'node');
        const kind = node ? nodeById.get(node.id)?.kind : undefined;
        if (node && (kind === 'terminal_box' || kind === 'junction_box'))
          toggleTarget(store, pick.owner.id, node.id);
      } else if (pick.mode === 'route') {
        const segment = hits.find((h) => h.kind === 'segment');
        if (segment) toggleRouteSegment(store, pick.owner, segment.id);
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
        onCalibrationPoints(next[0]!, next[1]!);
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
      const preset =
        tool === 'terminal_box' ? profile?.boxPresets.find((p) => p.id === presetId) : undefined;
      placeNode(store, tool, snap.point, onSegment, preset);
    }
  }

  const bg = floor?.background;
  const mpp = bg ? backgroundMetersPerPixel(bg) : 1;
  const step = gridStep(view.scale);
  const visible = {
    minX: -view.x / view.scale,
    minY: -view.y / view.scale,
    maxX: (size.width - view.x) / view.scale,
    maxY: (size.height - view.y) / view.scale,
  };
  const gridLines: number[][] = [];
  for (let x = Math.floor(visible.minX / step) * step; x <= visible.maxX; x += step) {
    gridLines.push([x, visible.minY, x, visible.maxY]);
  }
  for (let y = Math.floor(visible.minY / step) * step; y <= visible.maxY; y += step) {
    gridLines.push([visible.minX, y, visible.maxX, y]);
  }

  const moving = drag?.kind === 'move' && drag.moved && !drag.duplicate ? drag : null;
  const ghost = drag?.kind === 'move' && drag.moved && drag.duplicate ? drag : null;
  const posOf = (n: PlanNode): Point =>
    moving && moving.nodeIds.includes(n.id)
      ? { x: n.position.x + moving.delta.x, y: n.position.y + moving.delta.y }
      : n.position;
  const px = (v: number) => v / view.scale;
  const selected = new Set(selection);

  const floorSegments = doc.segments.filter((s) => {
    const a = nodeById.get(s.fromNodeId);
    const b = nodeById.get(s.toNodeId);
    return a?.floorId === floorId && b?.floorId === floorId;
  });
  const linkedRisers = new Set(
    doc.segments
      .filter((s) => nodeById.get(s.fromNodeId)?.floorId !== nodeById.get(s.toNodeId)?.floorId)
      .flatMap((s) => [s.fromNodeId, s.toNodeId]),
  );
  const conduitFrom = conduit ? nodeById.get(conduit.fromNodeId) : undefined;
  const activeRoute = activeOwner
    ? activeOwner.kind === 'circuit'
      ? routing.circuitRoutes.get(activeOwner.id)
      : routing.extraRunRoutes.get(activeOwner.id)
    : undefined;
  const highlighted = new Set(
    pick?.mode === 'route'
      ? (() => {
          const owner =
            pick.owner.kind === 'circuit'
              ? doc.circuits.find((c) => c.id === pick.owner.id)
              : doc.extraRuns.find((r) => r.id === pick.owner.id);
          return owner?.routing.mode === 'manual' ? owner.routing.segmentIds : [];
        })()
      : activeRoute?.ok
        ? activeRoute.segmentIds
        : [],
  );
  const activeTargets = new Set(
    activeOwner?.kind === 'circuit'
      ? (doc.circuits.find((c) => c.id === activeOwner.id)?.targetNodeIds ?? [])
      : activeOwner
        ? (() => {
            const r = doc.extraRuns.find((x) => x.id === activeOwner.id);
            return r ? [r.fromNodeId, r.toNodeId] : [];
          })()
        : [],
  );

  return (
    <div
      ref={container}
      className="relative h-full w-full overflow-hidden"
      data-testid="plan-canvas"
    >
      <Stage
        width={size.width}
        height={size.height}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          setDrag(null);
          setCursor(null);
        }}
        onClick={onClick}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          setWallStart(null);
          setConduit(null);
        }}
        style={{
          cursor: tool === 'select' ? (drag?.kind === 'pan' ? 'grabbing' : 'default') : 'crosshair',
        }}
      >
        <Layer listening={false}>
          {bg && image ? (
            <KonvaImage
              image={image}
              x={bg.offset.x}
              y={bg.offset.y}
              rotation={bg.rotation}
              scaleX={mpp}
              scaleY={mpp}
              opacity={bg.opacity}
            />
          ) : null}
          {gridLines.map((pts, i) => (
            <Line
              key={i}
              points={pts}
              stroke={colors.grid}
              strokeWidth={1}
              strokeScaleEnabled={false}
            />
          ))}
        </Layer>
        <Layer listening={false}>
          {(floor?.walls ?? []).map((w) => (
            <Line
              key={w.id}
              points={[w.a.x, w.a.y, w.b.x, w.b.y]}
              stroke={selected.has(w.id) ? colors.selection : colors.wall}
              strokeWidth={w.thickness}
              lineCap="square"
            />
          ))}
          {floorSegments.map((s) => {
            const a = posOf(nodeById.get(s.fromNodeId)!);
            const b = posOf(nodeById.get(s.toNodeId)!);
            const points = [a, ...s.vertices, b];
            const edge = Math.floor((points.length - 1) / 2);
            const label = {
              x: (points[edge]!.x + points[edge + 1]!.x) / 2,
              y: (points[edge]!.y + points[edge + 1]!.y) / 2,
            };
            return (
              <Group key={s.id}>
                {highlighted.has(s.id) ? (
                  <Line
                    points={points.flatMap((p) => [p.x, p.y])}
                    stroke={colors.highlight}
                    strokeWidth={10}
                    opacity={0.45}
                    strokeScaleEnabled={false}
                    lineJoin="round"
                  />
                ) : null}
                {selected.has(s.id) ? (
                  <Line
                    points={points.flatMap((p) => [p.x, p.y])}
                    stroke={colors.selection}
                    strokeWidth={8}
                    opacity={0.35}
                    strokeScaleEnabled={false}
                    lineJoin="round"
                  />
                ) : null}
                <Line
                  points={points.flatMap((p) => [p.x, p.y])}
                  stroke={colors.run[s.runElevation]}
                  strokeWidth={2.5}
                  strokeScaleEnabled={false}
                  lineJoin="round"
                  dash={s.runElevation === 'ceiling' ? [px(8), px(4)] : undefined}
                />
                {view.scale >= LABEL_MIN_SCALE ? (
                  <Text
                    x={label.x + px(4)}
                    y={label.y + px(4)}
                    text={formatLength(lengths.segmentLengthMm(s) / 1000, locale)}
                    fontSize={px(11)}
                    fill={colors.run[s.runElevation]}
                  />
                ) : null}
              </Group>
            );
          })}
          {floorNodes.map((n) => {
            const pos = posOf(n);
            return (
              <Group key={n.id} x={pos.x} y={pos.y}>
                {selected.has(n.id) ? (
                  <Circle radius={px(16)} fill={colors.selection} opacity={0.2} />
                ) : null}
                {activeTargets.has(n.id) ? (
                  <Circle
                    radius={px(15)}
                    stroke={colors.highlight}
                    strokeWidth={2.5}
                    strokeScaleEnabled={false}
                  />
                ) : null}
                <Path
                  data={symbolPaths[symbolOf(n)]}
                  x={px(-12)}
                  y={px(-12)}
                  scaleX={px(1)}
                  scaleY={px(1)}
                  stroke={n.kind === 'riser_point' ? colors.riser : colors.node}
                  strokeWidth={1.6}
                  strokeScaleEnabled={false}
                  fill={n.kind === 'panel' ? colors.node : undefined}
                  dash={n.status === 'provision' ? provisionDash : undefined}
                />
                {n.kind === 'riser_point' && !linkedRisers.has(n.id) ? (
                  <Circle radius={px(3)} x={px(10)} y={px(-10)} fill={colors.riser} />
                ) : null}
                {view.scale >= LABEL_MIN_SCALE / 2 ? (
                  <Text x={px(14)} y={px(-6)} text={n.label} fontSize={px(11)} fill={colors.node} />
                ) : null}
              </Group>
            );
          })}
          {ghost
            ? doc.nodes
                .filter((n) => ghost.nodeIds.includes(n.id))
                .map((n) => (
                  <Circle
                    key={n.id}
                    x={n.position.x + ghost.delta.x}
                    y={n.position.y + ghost.delta.y}
                    radius={px(12)}
                    stroke={colors.selection}
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    dash={[4, 3]}
                  />
                ))
            : null}
        </Layer>
        <Layer listening={false}>
          {wallStart && cursor ? (
            <Line
              points={[wallStart.x, wallStart.y, cursor.point.x, cursor.point.y]}
              stroke={colors.selection}
              strokeWidth={DEFAULT_WALL_THICKNESS}
              opacity={0.5}
            />
          ) : null}
          {conduitFrom ? (
            <Line
              points={[
                conduitFrom.position,
                ...conduit!.vertices,
                ...(cursor ? [cursor.point] : []),
              ].flatMap((p) => [p.x, p.y])}
              stroke={colors.run[settings.defaultRunElevation]}
              strokeWidth={2.5}
              strokeScaleEnabled={false}
              dash={[6, 4]}
            />
          ) : null}
          {bg
            ? calibration.map((cpx, i) => (
                <Circle
                  key={i}
                  {...backgroundPxToWorld(bg, cpx, mpp)}
                  radius={px(5)}
                  stroke={colors.highlight}
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                />
              ))
            : null}
          {drag?.kind === 'box' ? (
            <Rect
              x={Math.min(drag.start.x, drag.current.x)}
              y={Math.min(drag.start.y, drag.current.y)}
              width={Math.abs(drag.current.x - drag.start.x)}
              height={Math.abs(drag.current.y - drag.start.y)}
              stroke={colors.selection}
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={[4, 4]}
            />
          ) : null}
          {cursor && tool !== 'select' ? (
            <Rect
              x={cursor.point.x - px(4)}
              y={cursor.point.y - px(4)}
              width={px(8)}
              height={px(8)}
              stroke={
                cursor.kind === 'grid' || cursor.kind === 'none' ? colors.grid : colors.highlight
              }
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />
          ) : null}
        </Layer>
      </Stage>
    </div>
  );
}

function toBackgroundPx(floor: Floor, world: Point): Point {
  const bg = floor.background!;
  const withCalibration = bg.calibration
    ? bg
    : {
        ...bg,
        calibration: { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, realDistance: UNCALIBRATED_MPP },
      };
  return worldToBackground(withCalibration, world)!;
}

function backgroundPxToWorld(bg: NonNullable<Floor['background']>, p: Point, mpp: number): Point {
  const rad = (bg.rotation * Math.PI) / 180;
  const x = p.x * mpp;
  const y = p.y * mpp;
  return {
    x: bg.offset.x + x * Math.cos(rad) - y * Math.sin(rad),
    y: bg.offset.y + x * Math.sin(rad) + y * Math.cos(rad),
  };
}
