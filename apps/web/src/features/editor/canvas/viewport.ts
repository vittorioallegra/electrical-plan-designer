// Screen ↔ world transform of the plan canvas. World units are meters; `scale` is px per meter.
import type { Point } from '@/domain/types';

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 2;
export const MAX_SCALE = 2000;
export const DEFAULT_VIEW: View = { scale: 50, x: 80, y: 80 };

export function worldToScreen(view: View, p: Point): Point {
  return { x: view.x + p.x * view.scale, y: view.y + p.y * view.scale };
}

export function screenToWorld(view: View, p: Point): Point {
  return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
}

/** Zooms by `factor` keeping the world point under `anchor` (screen px) fixed. */
export function zoomAt(view: View, anchor: Point, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const world = screenToWorld(view, anchor);
  return { scale, x: anchor.x - world.x * scale, y: anchor.y - world.y * scale };
}

/** Same scale, panned so the world point `p` sits in the middle of a screen of `size`. */
export function centerOn(view: View, p: Point, size: { width: number; height: number }): View {
  return {
    scale: view.scale,
    x: size.width / 2 - p.x * view.scale,
    y: size.height / 2 - p.y * view.scale,
  };
}

/** View fitting the world box into a screen of `size` with a margin. */
export function fitView(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  size: { width: number; height: number },
  margin = 40,
): View {
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min((size.width - 2 * margin) / w, (size.height - 2 * margin) / h)),
  );
  return {
    scale,
    x: (size.width - w * scale) / 2 - box.minX * scale,
    y: (size.height - h * scale) / 2 - box.minY * scale,
  };
}

/** Grid spacing (m) so lines stay ≥ ~12 px apart: 0.1, 0.5, 1, 5, 10 m. */
export function gridStep(scale: number): number {
  for (const step of [0.1, 0.5, 1, 5, 10, 50]) if (step * scale >= 12) return step;
  return 100;
}

/** Snap grid: a fifth of the visible grid, never finer than 5 cm. */
export function snapStep(scale: number): number {
  return Math.max(0.05, gridStep(scale) / 5);
}
