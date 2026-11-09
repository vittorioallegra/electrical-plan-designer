import { Circle, Group, Layer, Line, Path, Rect, Text } from 'react-konva';
import type { LengthContext } from '@epd/domain/lengths';
import type { ReactNode } from 'react';
import type { ConduitSegment, PlanNode, Point, Wall } from '@epd/domain/types';
import { provisionDash, symbolPaths } from '@/components/symbols/symbols';
import { formatLength, type Locale } from '@/lib/format';
import { runDash, type CanvasColors } from '../canvasColors';
import { wallHandleRadius } from '../hitTest';
import { LABEL_FONT_PX, nodeLabelBox, segmentLabelBox, type LabelBox } from '../labels';
import { LABEL_MIN_SCALE, symbolOf } from '../planScene';

export interface PlanScene {
  walls: Wall[];
  /** The selected wall whose end handles are shown, dragged to resize or turn it. */
  handleWall: Wall | null;
  segments: ConduitSegment[];
  nodes: PlanNode[];
  nodeById: ReadonlyMap<string, PlanNode>;
  /** Drawn position of a node (follows a move drag). */
  posOf: (n: PlanNode) => Point;
  legs: ReadonlyMap<string, Point[]>;
  selected: ReadonlySet<string>;
  highlighted: ReadonlySet<string>;
  activeTargets: ReadonlySet<string>;
  linkedRisers: ReadonlySet<string>;
  /** Box columns on the floor: members top to bottom, by stackId. */
  columns: ReadonlyMap<string, readonly PlanNode[]>;
  /** The column opened as a list of its boxes. */
  explodedStackId: string | null;
  /** Copies shown while duplicating with Alt-drag. */
  ghost: { nodes: PlanNode[]; delta: Point } | null;
}

/** Walls, conduits with length labels, nodes with symbols and labels. */
export function PlanLayer({
  scene,
  scale,
  colors,
  lengths,
  locale,
}: {
  scene: PlanScene;
  scale: number;
  colors: CanvasColors;
  lengths: LengthContext;
  locale: Locale;
}) {
  const px = (v: number) => v / scale;
  // Text with a halo in the canvas background color, so it stays readable over conduits.
  const labelProps = (box: LabelBox, fill: string) => ({
    x: px(box.x),
    y: px(box.y),
    width: px(box.width),
    align: box.align,
    fontSize: px(LABEL_FONT_PX),
    fill,
    stroke: colors.background,
    strokeWidth: px(3),
    fillAfterStrokeEnabled: true,
  });
  const { selected, posOf } = scene;

  return (
    <Layer listening={false}>
      {scene.walls.map((w) => (
        <Line
          key={w.id}
          points={[w.a.x, w.a.y, w.b.x, w.b.y]}
          stroke={selected.has(w.id) ? colors.selection : colors.wall}
          strokeWidth={w.thickness}
          lineCap="square"
        />
      ))}
      {scene.segments.map((s) => {
        const a = posOf(scene.nodeById.get(s.fromNodeId)!);
        const b = posOf(scene.nodeById.get(s.toNodeId)!);
        const points = [a, ...s.vertices, b];
        const flat = points.flatMap((p) => [p.x, p.y]);
        const edge = Math.floor((points.length - 1) / 2);
        const label = {
          x: (points[edge]!.x + points[edge + 1]!.x) / 2,
          y: (points[edge]!.y + points[edge + 1]!.y) / 2,
        };
        const labelBox = segmentLabelBox(points[edge]!, points[edge + 1]!);
        return (
          <Group key={s.id}>
            {scene.highlighted.has(s.id) ? (
              <Line
                points={flat}
                stroke={colors.highlight}
                strokeWidth={10}
                opacity={0.45}
                strokeScaleEnabled={false}
                lineJoin="round"
              />
            ) : null}
            {selected.has(s.id) ? (
              <Line
                points={flat}
                stroke={colors.selection}
                strokeWidth={8}
                opacity={0.35}
                strokeScaleEnabled={false}
                lineJoin="round"
              />
            ) : null}
            <Line
              points={flat}
              stroke={colors.run}
              strokeWidth={2.5}
              strokeScaleEnabled={false}
              lineJoin="round"
              dash={[...runDash[s.runElevation]]}
            />
            {scale >= LABEL_MIN_SCALE ? (
              <Text
                {...labelProps(labelBox, colors.run)}
                x={label.x + px(labelBox.x)}
                y={label.y + px(labelBox.y)}
                text={formatLength(lengths.segmentLengthMm(s) / 1000, locale)}
              />
            ) : null}
          </Group>
        );
      })}
      {scene.nodes.map((n) => {
        const pos = posOf(n);
        const members = n.stackId ? scene.columns.get(n.stackId) : undefined;
        if (members) {
          // A column is drawn once, by its top box.
          if (members[0]?.id !== n.id) return null;
          return (
            <ColumnSymbol
              key={n.id}
              members={members}
              pos={pos}
              scale={scale}
              colors={colors}
              selected={members.some((m) => selected.has(m.id))}
              target={members.some((m) => scene.activeTargets.has(m.id))}
              exploded={scene.explodedStackId === n.stackId}
              label={
                scale >= LABEL_MIN_SCALE / 2 ? (
                  <Text
                    {...labelProps(
                      nodeLabelBox(
                        members.flatMap((m) => scene.legs.get(m.id) ?? []),
                        COLUMN_LABEL_GAP_PX,
                      ),
                      colors.node,
                    )}
                    text={members.map((m) => m.label).join(' · ')}
                  />
                ) : null
              }
            />
          );
        }
        return (
          <Group key={n.id} x={pos.x} y={pos.y}>
            {selected.has(n.id) ? (
              <Circle radius={px(16)} fill={colors.selection} opacity={0.2} />
            ) : null}
            {scene.activeTargets.has(n.id) ? (
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
              {...(n.kind === 'panel' ? { fill: colors.node } : {})}
              {...(n.status === 'provision' ? { dash: provisionDash } : {})}
            />
            {n.kind === 'riser_point' && !scene.linkedRisers.has(n.id) ? (
              <Circle radius={px(3)} x={px(10)} y={px(-10)} fill={colors.riser} />
            ) : null}
            {scale >= LABEL_MIN_SCALE / 2 ? (
              <Text
                {...labelProps(nodeLabelBox(scene.legs.get(n.id) ?? []), colors.node)}
                text={n.label}
              />
            ) : null}
          </Group>
        );
      })}
      {(scene.handleWall ? [scene.handleWall.a, scene.handleWall.b] : []).map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={wallHandleRadius(scene.handleWall!, scale)}
          fill={colors.background}
          stroke={colors.selection}
          strokeWidth={2}
          strokeScaleEnabled={false}
        />
      ))}
      {scene.ghost
        ? scene.ghost.nodes.map((n) => (
            <Circle
              key={n.id}
              x={n.position.x + scene.ghost!.delta.x}
              y={n.position.y + scene.ghost!.delta.y}
              radius={px(12)}
              stroke={colors.selection}
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              dash={[4, 3]}
            />
          ))
        : null}
    </Layer>
  );
}

/** Plate size of a column symbol, screen px. */
const PLATE_PX = 28;
/** Offset of each plate behind the front one, screen px. */
const PLATE_STEP_PX = 5;
/** Label distance from a column, clear of the plates and the badge, screen px. */
const COLUMN_LABEL_GAP_PX = 26;

/**
 * A box column: the top box's symbol on a plate, one offset plate behind it per further box (two
 * at most) and a count badge, so several boxes at one point read at a glance.
 */
function ColumnSymbol({
  members,
  pos,
  scale,
  colors,
  selected,
  target,
  exploded,
  label,
}: {
  members: readonly PlanNode[];
  pos: Point;
  scale: number;
  colors: CanvasColors;
  selected: boolean;
  target: boolean;
  exploded: boolean;
  label: ReactNode;
}) {
  const px = (v: number) => v / scale;
  const top = members[0]!;
  const behind = Math.min(members.length - 1, 2);
  const plate = (offset: number, front: boolean) => (
    <Rect
      key={offset}
      x={px(-PLATE_PX / 2 + offset)}
      y={px(-PLATE_PX / 2 - offset)}
      width={px(PLATE_PX)}
      height={px(PLATE_PX)}
      cornerRadius={px(4)}
      fill={colors.background}
      stroke={front ? (exploded ? colors.selection : colors.node) : colors.label}
      strokeWidth={front ? 1.5 : 1.2}
      strokeScaleEnabled={false}
    />
  );
  const badge = `×${members.length}`;
  return (
    <Group x={pos.x} y={pos.y}>
      {selected || exploded ? (
        <Circle radius={px(22)} fill={colors.selection} opacity={0.2} />
      ) : null}
      {target ? (
        <Circle
          radius={px(21)}
          stroke={colors.highlight}
          strokeWidth={2.5}
          strokeScaleEnabled={false}
        />
      ) : null}
      {Array.from({ length: behind }, (_, i) => plate((behind - i) * PLATE_STEP_PX, false))}
      {plate(0, true)}
      <Path
        data={symbolPaths[symbolOf(top)]}
        x={px(-11)}
        y={px(-11)}
        scaleX={px(22 / 24)}
        scaleY={px(22 / 24)}
        stroke={colors.node}
        strokeWidth={1.6}
        strokeScaleEnabled={false}
        {...(top.status === 'provision' ? { dash: provisionDash } : {})}
      />
      <Group x={px(PLATE_PX / 2 - 4)} y={px(PLATE_PX / 2 - 6)}>
        <Rect width={px(22)} height={px(15)} cornerRadius={px(7.5)} fill={colors.selection} />
        <Text
          width={px(22)}
          height={px(15)}
          align="center"
          verticalAlign="middle"
          fontSize={px(10)}
          fontStyle="500"
          fill={colors.background}
          text={badge}
        />
      </Group>
      {label}
    </Group>
  );
}
