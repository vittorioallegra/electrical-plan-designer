import { Circle, Group, Layer, Line, Path, Text } from 'react-konva';
import type { LengthContext } from '@epd/domain/lengths';
import type { ConduitSegment, PlanNode, Point, Wall } from '@epd/domain/types';
import { provisionDash, symbolPaths } from '@/components/symbols/symbols';
import { formatLength, type Locale } from '@/lib/format';
import type { CanvasColors } from '../canvasColors';
import { LABEL_FONT_PX, nodeLabelBox, segmentLabelBox, type LabelBox } from '../labels';
import { LABEL_MIN_SCALE, symbolOf } from '../planScene';

export interface PlanScene {
  walls: Wall[];
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
              stroke={colors.run[s.runElevation]}
              strokeWidth={2.5}
              strokeScaleEnabled={false}
              lineJoin="round"
              {...(s.runElevation === 'ceiling' ? { dash: [px(8), px(4)] } : {})}
            />
            {scale >= LABEL_MIN_SCALE ? (
              <Text
                {...labelProps(labelBox, colors.run[s.runElevation])}
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
