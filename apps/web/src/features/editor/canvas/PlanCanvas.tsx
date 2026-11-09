import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage } from 'react-konva';
import { createLengthContext } from '@epd/domain/lengths';
import type { PlanNode, Point } from '@epd/domain/types';
import { useLibrary } from '@/stores/library/useLibrary';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { useCanvasColors, useFontsReady } from './canvasColors';
import { ColumnList } from './ColumnList';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
import { draggedWall, usePlanPointer, type CanvasPickHandlers } from './hooks/usePlanPointer';
import { useStageSize } from './hooks/useStageSize';
import { useTouchNavigation } from './hooks/useTouchNavigation';
import { BackgroundLayer } from './layers/BackgroundLayer';
import { PlanLayer, type PlanScene } from './layers/PlanLayer';
import { ToolOverlayLayer } from './layers/ToolOverlayLayer';
import {
  activeTargetNodes,
  floorSegmentsOf,
  gridLines,
  highlightedSegments,
  legsByNode,
  linkedRisers,
} from './planScene';
import { useBackgroundImage } from './useBackgroundImage';
import { ZoomControl } from './ZoomControl';
import { centerOn, worldToScreen } from './viewport';

export interface PlanCanvasProps {
  onCalibrationPoints: (p1: Point, p2: Point) => void;
  onDeleteRequest: (ids: string[]) => void;
  /** Without handlers (read-only views) clicks in pick mode do nothing. */
  pickHandlers?: CanvasPickHandlers | undefined;
}

/** The plan canvas: background, grid, walls, conduits, nodes and the active tool (meters). */
export function PlanCanvas({
  onCalibrationPoints,
  onDeleteRequest,
  pickHandlers,
}: PlanCanvasProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const container = useRef<HTMLDivElement>(null);
  const size = useStageSize(container);
  const view = useEditor((s) => s.ui.view);
  const tool = useEditor((s) => s.ui.tool);
  const floorId = useEditor((s) => s.ui.floorId);
  const selection = useEditor((s) => s.ui.selection);
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  const settings = useEditor((s) => s.data.settings);
  const floor = doc.floors.find((f) => f.id === floorId);
  const { image } = useBackgroundImage(floor?.background?.assetId);
  const boxPresets = useLibrary((s) => s.library.boxPresets);
  const presetId = useEditor((s) => s.ui.presetId);
  const pick = useEditor((s) => s.ui.pick);
  const activeOwner = useEditor((s) => s.ui.activeOwner);
  const { routing, warnings } = useAnalysis();
  const colors = useCanvasColors();
  const fontsReady = useFontsReady();

  // A focus request (e.g. from the warnings tab) pans the view to that point once.
  const focus = useEditor((s) => s.ui.focus);
  useEffect(() => {
    if (!focus) return;
    const state = store.getState();
    state.setUi({ view: centerOn(state.ui.view, focus, size), focus: null });
  }, [focus, size, store]);

  const lengths = useMemo(() => createLengthContext(doc, settings), [doc, settings]);
  const floorNodes = useMemo(() => doc.nodes.filter((n) => n.floorId === floorId), [doc, floorId]);
  // Box columns on this floor, boxes top to bottom.
  const columns = useMemo(() => {
    const map = new Map<string, PlanNode[]>();
    for (const n of floorNodes)
      if (n.stackId) map.set(n.stackId, [...(map.get(n.stackId) ?? []), n]);
    for (const members of map.values())
      members.sort(
        (a, b) => lengths.nodeHeightMm(b.id) - lengths.nodeHeightMm(a.id) || (a.id < b.id ? -1 : 1),
      );
    return map;
  }, [floorNodes, lengths]);
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const nodeById = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc]);
  const snapTargets = useMemo(() => {
    const ids = new Set(floorNodes.map((n) => n.id));
    return {
      nodes: floorNodes.map((n) => ({ id: n.id, position: n.position })),
      vertices: doc.segments.filter((s) => ids.has(s.fromNodeId)).flatMap((s) => s.vertices),
      wallEnds: (floor?.walls ?? []).flatMap((w) => [w.a, w.b]),
    };
  }, [floorNodes, doc.segments, floor]);

  const pointer = usePlanPointer({
    store,
    view,
    tool,
    floorId,
    floor,
    doc,
    nodeById,
    snapTargets,
    pick,
    pickHandlers,
    boxPreset: boxPresets.find((p) => p.id === presetId),
    onCalibrationPoints,
  });
  useCanvasKeyboard({ store, tool, pointer, onDeleteRequest });
  const touch = useTouchNavigation(store, container);

  const { drag } = pointer;
  const moving = drag?.kind === 'move' && drag.moved && !drag.duplicate ? drag : null;
  const ghost = drag?.kind === 'move' && drag.moved && drag.duplicate ? drag : null;
  const posOf = (n: PlanNode): Point =>
    moving && moving.nodeIds.includes(n.id)
      ? { x: n.position.x + moving.delta.x, y: n.position.y + moving.delta.y }
      : n.position;
  // A column's vertical conduits have no plan length: they are not drawn.
  const segments = floorSegmentsOf(doc, nodeById, floorId).filter((s) => {
    const stack = nodeById.get(s.fromNodeId)?.stackId;
    return !stack || stack !== nodeById.get(s.toNodeId)?.stackId;
  });
  const exploded = pointer.exploded;
  const explodedMembers = exploded ? columns.get(exploded.stackId) : undefined;
  const highlighted = highlightedSegments(doc, routing, pick, activeOwner);
  if (explodedMembers && hoveredMember)
    for (const s of segments)
      if (s.fromNodeId === hoveredMember || s.toNodeId === hoveredMember) highlighted.add(s.id);
  const walls = (floor?.walls ?? []).map((w) => draggedWall(w, drag));
  const handleWall =
    tool === 'select' && !readOnly && selection.length === 1
      ? walls.find((w) => w.id === selection[0])
      : undefined;
  const scene: PlanScene = {
    walls,
    handleWall: handleWall ?? null,
    segments,
    nodes: floorNodes,
    nodeById,
    posOf,
    legs: legsByNode(segments, nodeById, posOf),
    selected: new Set(selection),
    highlighted,
    activeTargets: activeTargetNodes(doc, activeOwner),
    linkedRisers: linkedRisers(doc, nodeById),
    columns,
    explodedStackId: explodedMembers ? exploded!.stackId : null,
    ghost: ghost
      ? { nodes: doc.nodes.filter((n) => ghost.nodeIds.includes(n.id)), delta: ghost.delta }
      : null,
  };

  return (
    <div
      ref={container}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{ background: colors.background }}
      data-testid="plan-canvas"
    >
      <Stage
        width={size.width}
        height={size.height}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        {...touch}
        {...pointer.handlers}
        style={{
          cursor:
            tool === 'select'
              ? selectCursor(drag?.kind, readOnly ? null : pointer.hover)
              : 'crosshair',
        }}
      >
        <BackgroundLayer
          background={floor?.background}
          image={image}
          mpp={pointer.mpp}
          gridLines={gridLines(view, size)}
          colors={colors}
        />
        <PlanLayer
          key={String(fontsReady)}
          scene={scene}
          scale={view.scale}
          colors={colors}
          lengths={lengths}
          locale={locale}
        />
        <ToolOverlayLayer
          pointer={pointer}
          tool={tool}
          scale={view.scale}
          colors={colors}
          background={floor?.background}
          nodeById={nodeById}
          runElevation={settings.defaultRunElevation}
        />
      </Stage>
      {exploded && explodedMembers ? (
        <ColumnList
          key={`${exploded.stackId}|${exploded.purpose}`}
          members={explodedMembers}
          heightM={(id) => lengths.nodeHeightMm(id) / 1000}
          anchor={worldToScreen(view, explodedMembers[0]!.position)}
          boundsWidth={size.width}
          selected={new Set(exploded.purpose === 'select' ? selection : [])}
          disabled={
            exploded.purpose === 'conduit' && pointer.conduit
              ? new Set([pointer.conduit.fromNodeId])
              : undefined
          }
          warned={
            new Set(
              warnings.flatMap((w) => (w.elementRef.kind === 'node' ? [w.elementRef.id] : [])),
            )
          }
          onPick={pointer.pickMember}
          onHover={setHoveredMember}
          onClose={() => {
            setHoveredMember(null);
            pointer.closeExploded();
          }}
        />
      ) : null}
      <ZoomControl size={size} />
    </div>
  );
}

function selectCursor(drag: string | undefined, hover: 'wall' | 'handle' | null): string {
  if (drag === 'pan' || drag === 'wall' || drag === 'wall-end') return 'grabbing';
  if (hover === 'handle') return 'crosshair';
  return hover === 'wall' ? 'move' : 'default';
}
