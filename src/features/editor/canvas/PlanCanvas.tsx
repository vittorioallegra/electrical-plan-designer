import type Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage } from 'react-konva';
import { metersPerPixel, worldToBackground } from '@/domain/geometry';
import { newId } from '@/domain/ids';
import type { Floor, Point } from '@/domain/types';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import { snapPoint, type SnapResult } from './snapping';
import { useBackgroundImage } from './useBackgroundImage';
import { gridStep, screenToWorld, snapStep, zoomAt, type View } from './viewport';

/** Meters per background pixel before calibration (1 px = 1 cm). */
export const UNCALIBRATED_MPP = 0.01;
export const DEFAULT_WALL_THICKNESS = 0.2;

const css = (name: string) =>
  typeof document === 'undefined'
    ? '#000'
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

export interface PlanCanvasProps {
  onCalibrationPoints: (p1: Point, p2: Point) => void;
}

/** The plan canvas: background, grid, walls and the active tool. World units are meters. */
export function PlanCanvas({ onCalibrationPoints }: PlanCanvasProps) {
  const { store } = useEditorContext();
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const view = useEditor((s) => s.ui.view);
  const tool = useEditor((s) => s.ui.tool);
  const floorId = useEditor((s) => s.ui.floorId);
  const selection = useEditor((s) => s.ui.selection);
  const floor = useEditor((s) => s.data.doc.floors.find((f) => f.id === s.ui.floorId));
  const nodes = useEditor((s) => s.data.doc.nodes);
  const segments = useEditor((s) => s.data.doc.segments);
  const { image } = useBackgroundImage(floor?.background?.storagePath);

  const [cursor, setCursor] = useState<SnapResult | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [calibration, setCalibration] = useState<Point[]>([]);
  const pan = useRef<{ start: Point; view: View } | null>(null);

  const colors = useMemo(
    () => ({
      grid: css('--color-canvas-grid'),
      wall: css('--color-canvas-wall'),
      selection: css('--color-canvas-selection'),
      highlight: css('--color-canvas-highlight'),
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

  // Tool switches and floor switches reset the in-progress action.
  const actionKey = `${tool}|${floorId}`;
  const [lastActionKey, setLastActionKey] = useState(actionKey);
  if (lastActionKey !== actionKey) {
    setLastActionKey(actionKey);
    setWallStart(null);
    setCalibration([]);
  }

  function deleteSelectedWalls() {
    const s = store.getState();
    const ids = new Set(s.ui.selection);
    s.applyCommand('delete walls', (d) => {
      for (const f of d.doc.floors) f.walls = f.walls.filter((w) => !ids.has(w.id));
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'Escape') {
        if (wallStart || calibration.length > 0) {
          setWallStart(null);
          setCalibration([]);
        } else {
          store.getState().setUi({ tool: 'select', selection: [] });
        }
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        store.getState().ui.selection.length > 0
      ) {
        e.preventDefault();
        deleteSelectedWalls();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const snapTargets = useMemo(() => {
    const onFloor = nodes.filter((n) => n.floorId === floorId);
    const ids = new Set(onFloor.map((n) => n.id));
    return {
      nodes: onFloor.map((n) => ({ id: n.id, position: n.position })),
      vertices: segments.filter((s) => ids.has(s.fromNodeId)).flatMap((s) => s.vertices),
      wallEnds: (floor?.walls ?? []).flatMap((w) => [w.a, w.b]),
    };
  }, [nodes, segments, floor, floorId]);

  function pointer(stage: Konva.Stage | null): Point | null {
    const p = stage?.getPointerPosition();
    return p ? screenToWorld(view, p) : null;
  }

  function snapped(raw: Point, alt: boolean): SnapResult {
    return snapPoint(raw, snapTargets, {
      scale: view.scale,
      gridStep: snapStep(view.scale),
      enabled: !alt,
    });
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const p = e.target.getStage()?.getPointerPosition();
    if (!p) return;
    const factor = Math.pow(1.0015, -e.evt.deltaY);
    store.getState().setUi({ view: zoomAt(view, p, factor) });
  }

  function onMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!p) return;
    const onEmpty = e.target === stage;
    if (e.evt.button === 1 || (tool === 'select' && onEmpty && e.evt.button === 0)) {
      pan.current = { start: p, view };
    }
  }

  function onMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!p) return;
    if (pan.current) {
      const { start, view: v } = pan.current;
      store.getState().setUi({ view: { ...v, x: v.x + p.x - start.x, y: v.y + p.y - start.y } });
      return;
    }
    const world = pointer(stage);
    if (world && tool !== 'select') {
      setCursor(
        tool === 'calibrate' ? { point: world, kind: 'none' } : snapped(world, e.evt.altKey),
      );
    }
  }

  function onMouseUp() {
    pan.current = null;
  }

  function onClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return;
    const stage = e.target.getStage();
    const world = pointer(stage);
    if (!world) return;
    const s = store.getState();
    if (tool === 'select') {
      const wallId = (e.target.attrs as { wallId?: string }).wallId;
      if (wallId) {
        s.setUi({
          selection: e.evt.shiftKey
            ? s.ui.selection.includes(wallId)
              ? s.ui.selection.filter((id) => id !== wallId)
              : [...s.ui.selection, wallId]
            : [wallId],
        });
      } else if (e.target === stage) {
        s.setUi({ selection: [] });
      }
      return;
    }
    if (tool === 'wall') {
      const point = snapped(world, e.evt.altKey).point;
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
      const px = toBackgroundPx(floor, world);
      const next = [...calibration, px];
      if (next.length === 2) {
        setCalibration([]);
        onCalibrationPoints(next[0]!, next[1]!);
      } else {
        setCalibration(next);
      }
    }
  }

  const bg = floor?.background;
  const mpp = bg
    ? bg.calibration
      ? (metersPerPixel(bg.calibration) ?? UNCALIBRATED_MPP)
      : UNCALIBRATED_MPP
    : 1;
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
          pan.current = null;
          setCursor(null);
        }}
        onClick={onClick}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          setWallStart(null);
        }}
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
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
        </Layer>
        <Layer listening={false}>
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
        <Layer>
          {(floor?.walls ?? []).map((w) => (
            <Line
              key={w.id}
              points={[w.a.x, w.a.y, w.b.x, w.b.y]}
              stroke={selection.includes(w.id) ? colors.selection : colors.wall}
              strokeWidth={w.thickness}
              lineCap="square"
              hitStrokeWidth={Math.max(w.thickness, 10 / view.scale)}
              wallId={w.id}
            />
          ))}
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
          {bg
            ? calibration.map((px, i) => (
                <Group key={i}>
                  <Circle
                    {...backgroundPxToWorld(bg, px, mpp)}
                    radius={5 / view.scale}
                    stroke={colors.highlight}
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                  />
                </Group>
              ))
            : null}
          {cursor && tool !== 'select' ? (
            <Rect
              x={cursor.point.x - 4 / view.scale}
              y={cursor.point.y - 4 / view.scale}
              width={8 / view.scale}
              height={8 / view.scale}
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

function backgroundPxToWorld(bg: NonNullable<Floor['background']>, px: Point, mpp: number): Point {
  const rad = (bg.rotation * Math.PI) / 180;
  const x = px.x * mpp;
  const y = px.y * mpp;
  return {
    x: bg.offset.x + x * Math.cos(rad) - y * Math.sin(rad),
    y: bg.offset.y + x * Math.sin(rad) + y * Math.cos(rad),
  };
}
