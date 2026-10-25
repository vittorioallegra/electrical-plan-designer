import { describe, expect, it } from 'vitest';
import demo from '../../tests/fixtures/demo-project.json';
import { rebuildRisers } from './risers';
import type { ProjectDoc } from './types';

const ids = () => {
  let n = 0;
  return () => `new${n++}`;
};

describe('rebuildRisers', () => {
  // protects=riser derivation is idempotent; fails_when=a consistent doc gains or loses risers; no_claim=—
  it('leaves a consistent doc unchanged', () => {
    const d = structuredClone(demo) as ProjectDoc;
    expect(rebuildRisers(d, ids())).toEqual([]);
    expect(d).toEqual(demo);
  });

  // protects=floor reorder; fails_when=risers keep linking floors that are no longer adjacent; no_claim=manual route repair
  it('rebuilds risers after floors are reordered', () => {
    const d = structuredClone(demo) as ProjectDoc;
    // New order: f1 (0), f0 (1), f2 (2): risers become f1–f0 and f0–f2.
    d.floors.find((f) => f.id === 'f0')!.order = 1;
    d.floors.find((f) => f.id === 'f1')!.order = 0;
    const removed = rebuildRisers(d, ids());
    expect(removed).toEqual(['s09']);
    const risers = d.segments.filter((s) => s.id === 's06' || s.id.startsWith('new'));
    expect(risers.map((s) => [s.fromNodeId, s.toNodeId].sort())).toEqual([
      ['n_r0', 'n_r1'],
      ['n_r0', 'n_r2'],
    ]);
  });

  // protects=unlinking; fails_when=removing a riser point leaves its riser segment; no_claim=—
  it('links a new riser point and drops risers of removed points', () => {
    const d = structuredClone(demo) as ProjectDoc;
    d.nodes = d.nodes.filter((n) => n.id !== 'n_r2');
    d.segments = d.segments.filter((s) => s.toNodeId !== 'n_r2' && s.fromNodeId !== 'n_r2');
    expect(rebuildRisers(d, ids())).toEqual([]);
    d.nodes.push({
      id: 'n_r2b',
      floorId: 'f2',
      kind: 'riser_point',
      position: { x: 0, y: 1 },
      label: 'R',
      status: 'active',
      riserGroupId: 'rg1',
    });
    rebuildRisers(d, ids());
    expect(d.segments.find((s) => s.id === 'new0')).toMatchObject({
      fromNodeId: 'n_r1',
      toNodeId: 'n_r2b',
    });
  });
});
