import type { Point } from '@/domain/types';

/** Text box of a canvas label in screen pixels, relative to its anchor (a node or a segment midpoint). */
export interface LabelBox {
  x: number;
  y: number;
  width: number;
  align: 'left' | 'center' | 'right';
}

export const LABEL_FONT_PX = 11;
const LABEL_WIDTH_PX = 160;
const NODE_GAP_PX = 14;
const SEGMENT_GAP_PX = 5;

type Side = 'right' | 'below' | 'left' | 'above';
// Preference order on ties; y grows downwards.
const sides: { side: Side; dir: Point }[] = [
  { side: 'right', dir: { x: 1, y: 0 } },
  { side: 'below', dir: { x: 0, y: 1 } },
  { side: 'left', dir: { x: -1, y: 0 } },
  { side: 'above', dir: { x: 0, y: -1 } },
];

function unit(v: Point): Point | null {
  const len = Math.hypot(v.x, v.y);
  return len > 0 ? { x: v.x / len, y: v.y / len } : null;
}

/**
 * Places a node label on the side farthest from the conduits leaving the node.
 * `legs` are the directions (world vectors) of the first leg of each attached segment.
 */
export function nodeLabelBox(legs: readonly Point[]): LabelBox {
  const dirs = legs.map(unit).filter((d): d is Point => d !== null);
  let best = sides[0]!;
  let bestScore = Infinity;
  for (const candidate of sides) {
    // How closely the most aligned leg points at this side (1 = straight through the label).
    const score = Math.max(-1, ...dirs.map((d) => d.x * candidate.dir.x + d.y * candidate.dir.y));
    if (score < bestScore - 1e-9) {
      best = candidate;
      bestScore = score;
    }
  }
  const half = LABEL_FONT_PX / 2;
  switch (best.side) {
    case 'right':
      return { x: NODE_GAP_PX, y: -half, width: LABEL_WIDTH_PX, align: 'left' };
    case 'left':
      return { x: -NODE_GAP_PX - LABEL_WIDTH_PX, y: -half, width: LABEL_WIDTH_PX, align: 'right' };
    case 'below':
      return { x: -LABEL_WIDTH_PX / 2, y: NODE_GAP_PX, width: LABEL_WIDTH_PX, align: 'center' };
    case 'above':
      return {
        x: -LABEL_WIDTH_PX / 2,
        y: -NODE_GAP_PX - LABEL_FONT_PX,
        width: LABEL_WIDTH_PX,
        align: 'center',
      };
  }
}

/** Places a length label beside the edge a→b: above mostly horizontal edges, right of vertical ones. */
export function segmentLabelBox(a: Point, b: Point): LabelBox {
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    return {
      x: -LABEL_WIDTH_PX / 2,
      y: -SEGMENT_GAP_PX - LABEL_FONT_PX,
      width: LABEL_WIDTH_PX,
      align: 'center',
    };
  }
  return { x: SEGMENT_GAP_PX, y: -LABEL_FONT_PX / 2, width: LABEL_WIDTH_PX, align: 'left' };
}
