// Plane geometry in meters, plus the integer-millimeter helpers used by every length sum.
import type { Background, Calibration, Point } from './types';

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1]!, points[i]!);
  return total;
}

/** Meters → integer millimeters. Every domain length sum works on these. */
export function toMm(meters: number): number {
  return Math.round(meters * 1000);
}

export function mmToM(mm: number): number {
  return mm / 1000;
}

/** Rounds away float noise (12.000000000000002 → 12) before a ceil. */
export function ceilClean(value: number): number {
  return Math.ceil(Math.round(value * 1e6) / 1e6);
}

/** Meters per background pixel from a two-point calibration; null when degenerate. */
export function metersPerPixel(calibration: Calibration): number | null {
  const px = distance(calibration.p1, calibration.p2);
  if (px < 1e-9 || !(calibration.realDistance > 0)) return null;
  return calibration.realDistance / px;
}

/** Uncalibrated backgrounds show at 1 px = 1 cm. */
export const UNCALIBRATED_MPP = 0.01;

/** Meters per background pixel: the calibration, or 1 px = 1 cm until calibrated. */
export function backgroundMetersPerPixel(background: Background): number {
  return (background.calibration && metersPerPixel(background.calibration)) ?? UNCALIBRATED_MPP;
}

/**
 * Background pixel → world meters: scale by the calibration, rotate (degrees) around the
 * image origin, then translate by the offset (meters). Plan elements stay in meters, so a
 * recalibration only moves the background.
 */
export function backgroundToWorld(background: Background, px: Point): Point | null {
  const scale = background.calibration ? metersPerPixel(background.calibration) : null;
  if (scale === null) return null;
  const rad = (background.rotation * Math.PI) / 180;
  const x = px.x * scale;
  const y = px.y * scale;
  return {
    x: background.offset.x + x * Math.cos(rad) - y * Math.sin(rad),
    y: background.offset.y + x * Math.sin(rad) + y * Math.cos(rad),
  };
}

/** Inverse of backgroundToWorld: world meters → background pixel. */
export function worldToBackground(background: Background, world: Point): Point | null {
  const scale = background.calibration ? metersPerPixel(background.calibration) : null;
  if (scale === null) return null;
  const rad = (-background.rotation * Math.PI) / 180;
  const dx = world.x - background.offset.x;
  const dy = world.y - background.offset.y;
  return {
    x: (dx * Math.cos(rad) - dy * Math.sin(rad)) / scale,
    y: (dx * Math.sin(rad) + dy * Math.cos(rad)) / scale,
  };
}

/** Closest point of a polyline to `p`: distance, point and the index of the hit edge. */
export function projectOnPolyline(
  points: readonly Point[],
  p: Point,
): { distance: number; point: Point; edgeIndex: number } {
  let best = { distance: Infinity, point: points[0] ?? p, edgeIndex: 0 };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = distance(p, q);
    if (d < best.distance) best = { distance: d, point: q, edgeIndex: i - 1 };
  }
  return best;
}
