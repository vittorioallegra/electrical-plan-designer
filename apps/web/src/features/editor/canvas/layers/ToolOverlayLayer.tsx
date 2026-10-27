import { Circle, Layer, Line, Rect } from 'react-konva';
import type { Floor, PlanNode, RunElevation } from '@epd/domain/types';
import { runDash, type CanvasColors } from '../canvasColors';
import type { PlanPointer } from '../hooks/usePlanPointer';
import { backgroundPxToWorld, DEFAULT_WALL_THICKNESS } from '../planScene';

/** Previews of the action in progress: wall, conduit, calibration points, box, snap cursor. */
export function ToolOverlayLayer({
  pointer,
  tool,
  scale,
  colors,
  background,
  nodeById,
  runElevation,
}: {
  pointer: PlanPointer;
  tool: string;
  scale: number;
  colors: CanvasColors;
  background: Floor['background'];
  nodeById: ReadonlyMap<string, PlanNode>;
  runElevation: RunElevation;
}) {
  const px = (v: number) => v / scale;
  const { cursor, wallStart, conduit, calibration, drag, mpp } = pointer;
  const conduitFrom = conduit ? nodeById.get(conduit.fromNodeId) : undefined;
  return (
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
          stroke={colors.run}
          strokeWidth={2.5}
          strokeScaleEnabled={false}
          dash={[...runDash[runElevation]]}
        />
      ) : null}
      {background
        ? calibration.map((cpx, i) => (
            <Circle
              key={i}
              {...backgroundPxToWorld(background, cpx, mpp)}
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
          stroke={cursor.kind === 'grid' || cursor.kind === 'none' ? colors.grid : colors.highlight}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      ) : null}
    </Layer>
  );
}
