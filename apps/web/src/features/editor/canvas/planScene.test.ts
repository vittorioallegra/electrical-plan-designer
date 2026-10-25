import { describe, expect, it } from 'vitest';
import demo from '../../../../../../tests/fixtures/demo-project.json';
import type { RoutingResult } from '@epd/domain/routing';
import type { ProjectDoc } from '@epd/domain/types';
import {
  activeTargetNodes,
  floorSegmentsOf,
  gridLines,
  highlightedSegments,
  linkedRisers,
} from './planScene';

const doc = demo as ProjectDoc;
const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
const routing = {
  circuitRoutes: new Map([['c1', { ok: true, segmentIds: ['s03'] }]]),
  extraRunRoutes: new Map(),
} as unknown as RoutingResult;

describe('plan scene', () => {
  // protects=per-floor drawing; fails_when=a conduit to another floor is drawn on this floor or one on it is missing; no_claim=riser rendering
  it('keeps only the segments with both ends on the floor, and finds linked risers', () => {
    const segments = floorSegmentsOf(doc, nodeById, 'f0');
    for (const s of segments) {
      expect(nodeById.get(s.fromNodeId)?.floorId).toBe('f0');
      expect(nodeById.get(s.toNodeId)?.floorId).toBe('f0');
    }
    const crossFloor = doc.segments.filter(
      (s) => nodeById.get(s.fromNodeId)?.floorId !== nodeById.get(s.toNodeId)?.floorId,
    );
    expect(segments.length + crossFloor.length).toBeLessThanOrEqual(doc.segments.length);
    for (const s of crossFloor) expect(linkedRisers(doc, nodeById)).toContain(s.fromNodeId);
  });

  // protects=route highlight; fails_when=picking shows the computed route instead of the manual one, or the active circuit is not highlighted; no_claim=routing itself
  it('highlights the manual route while picking, else the active computed route', () => {
    const owner = { kind: 'circuit' as const, id: 'c1' };
    expect([...highlightedSegments(doc, routing, null, owner)]).toEqual(['s03']);
    expect([...highlightedSegments(doc, routing, { mode: 'route', owner }, owner)]).toEqual([]);
    expect(highlightedSegments(doc, routing, null, null).size).toBe(0);
  });

  // protects=target highlight; fails_when=an active circuit or extra run does not mark its boxes; no_claim=—
  it('marks the targets of the active circuit and both ends of an extra run', () => {
    expect(activeTargetNodes(doc, { kind: 'circuit', id: 'c1' })).toEqual(
      new Set(['n_sw1', 'n_l1']),
    );
    expect(activeTargetNodes(doc, { kind: 'extra', id: 'x1' })).toEqual(new Set(['n_sw1', 'n_l1']));
    expect(activeTargetNodes(doc, null).size).toBe(0);
  });

  // protects=grid coverage; fails_when=the grid misses part of the visible area; no_claim=grid step choice (viewport tests)
  it('covers the visible area with grid lines', () => {
    const lines = gridLines({ scale: 50, x: 0, y: 0 }, { width: 500, height: 300 });
    const xs = lines.filter((l) => l[0] === l[2]).map((l) => l[0]!);
    const ys = lines.filter((l) => l[1] === l[3]).map((l) => l[1]!);
    expect(Math.min(...xs)).toBeLessThanOrEqual(0);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(10 - 1);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(6 - 1);
  });
});
