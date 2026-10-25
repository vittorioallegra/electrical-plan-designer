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
