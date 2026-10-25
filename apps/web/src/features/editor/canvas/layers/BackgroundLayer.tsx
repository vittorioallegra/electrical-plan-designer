import { Image as KonvaImage, Layer, Line } from 'react-konva';
import type { Floor } from '@epd/domain/types';
import type { CanvasColors } from '../canvasColors';

/** Background image (meters per pixel `mpp`) and the grid. */
export function BackgroundLayer({
  background,
  image,
  mpp,
  gridLines,
  colors,
}: {
  background: Floor['background'];
  image: HTMLImageElement | null;
  mpp: number;
  gridLines: number[][];
  colors: CanvasColors;
}) {
  return (
    <Layer listening={false}>
      {background && image ? (
        <KonvaImage
          image={image}
          x={background.offset.x}
          y={background.offset.y}
          rotation={background.rotation}
          scaleX={mpp}
          scaleY={mpp}
          opacity={background.opacity}
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
  );
}
