import { describe, expect, it } from 'vitest';
import { doc, floor } from './testing/builders';
import type { ProjectDoc } from './types';
import { moveWall, moveWallEnd, setWallLength } from './walls';

/** Two walls meeting at (4, 0): w1 from the origin, w2 going down. */
function room(): ProjectDoc {
  const f = floor('f0', 0);
  f.walls = [
    { id: 'w1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.2 },
    { id: 'w2', a: { x: 4, y: 0 }, b: { x: 4, y: 3 }, thickness: 0.2 },
  ];
  return doc({ floors: [f] });
}

const wallsOf = (d: ProjectDoc) => d.floors[0]!.walls;

describe('wall edits', () => {
  // protects=moving a wall on the canvas; fails_when=a moved wall changes length or drags its neighbour; no_claim=snapping (canvas)
  it('moves a wall by a delta and leaves connected walls where they are', () => {
    const d = room();
    moveWall(d, 'w1', { x: 0.5, y: 1 });
    expect(wallsOf(d)[0]).toMatchObject({ a: { x: 0.5, y: 1 }, b: { x: 4.5, y: 1 } });
    expect(wallsOf(d)[1]).toMatchObject({ a: { x: 4, y: 0 }, b: { x: 4, y: 3 } });
  });

  // protects=endpoint handles; fails_when=dragging one end moves the other end or a connected wall; no_claim=—
  it('moves one end, which resizes and rotates the wall around the other end', () => {
    const d = room();
    moveWallEnd(d, 'w1', 'b', { x: 3, y: 3 });
    expect(wallsOf(d)[0]).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 3, y: 3 } });
    expect(wallsOf(d)[1]!.a).toEqual({ x: 4, y: 0 });
    moveWallEnd(d, 'w1', 'a', { x: -1, y: 0 });
    expect(wallsOf(d)[0]).toMatchObject({ a: { x: -1, y: 0 }, b: { x: 3, y: 3 } });
  });

  // protects=no zero-length walls; fails_when=dropping an end on the other end collapses the wall; no_claim=—
  it('ignores an end dropped on the other end', () => {
    const d = room();
    moveWallEnd(d, 'w1', 'b', { x: 0, y: 0.001 });
    expect(wallsOf(d)[0]!.b).toEqual({ x: 4, y: 0 });
  });

  // protects=inspector length field; fails_when=a new length moves the start or turns the wall; no_claim=—
  it('sets the length keeping the start and direction', () => {
    const d = room();
    setWallLength(d, 'w2', 1.5);
    expect(wallsOf(d)[1]).toMatchObject({ a: { x: 4, y: 0 }, b: { x: 4, y: 1.5 } });
    setWallLength(d, 'w2', 0);
    expect(wallsOf(d)[1]!.b).toEqual({ x: 4, y: 1.5 });
  });
});
