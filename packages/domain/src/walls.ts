// Wall edits. Walls are independent segments: moving one never drags the walls it touches.
import { distance } from './geometry';
import type { Point, ProjectDoc, Wall } from './types';

export type WallEnd = 'a' | 'b';

/** Shortest wall an edit may leave (m); shorter results are ignored. */
export const MIN_WALL_LENGTH = 0.01;

export function findWall(doc: ProjectDoc, wallId: string): Wall | undefined {
  for (const f of doc.floors) {
    const w = f.walls.find((x) => x.id === wallId);
    if (w) return w;
  }
  return undefined;
}

/** Translates a wall by `delta`. */
export function moveWall(doc: ProjectDoc, wallId: string, delta: Point): void {
  const w = findWall(doc, wallId);
  if (!w) return;
  w.a = { x: w.a.x + delta.x, y: w.a.y + delta.y };
  w.b = { x: w.b.x + delta.x, y: w.b.y + delta.y };
}

/** Puts one end of a wall at `point` (resizes and rotates it around the other end). */
export function moveWallEnd(doc: ProjectDoc, wallId: string, end: WallEnd, point: Point): void {
  const w = findWall(doc, wallId);
  if (!w) return;
  if (distance(point, end === 'a' ? w.b : w.a) < MIN_WALL_LENGTH) return;
  w[end] = { ...point };
}

/** Sets a wall's length keeping its start and direction. */
export function setWallLength(doc: ProjectDoc, wallId: string, length: number): void {
  const w = findWall(doc, wallId);
  if (!w || length < MIN_WALL_LENGTH) return;
  const ratio = length / distance(w.a, w.b);
  w.b = { x: w.a.x + (w.b.x - w.a.x) * ratio, y: w.a.y + (w.b.y - w.a.y) * ratio };
}
