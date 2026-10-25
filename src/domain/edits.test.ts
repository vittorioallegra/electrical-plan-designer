import { describe, expect, it } from 'vitest';
import demo from '../../tests/fixtures/demo-project.json';
import { createCatalogLookup } from './catalog/lookup';
import { runChecks } from './checks';
import { defaultProjectSettings } from './defaults';
import { cascadeOf, deleteElements, deleteFloor, moveFloor } from './edits';
import { projectDocSchema } from './schema';
import type { ProjectDoc } from './types';

const genId = (() => {
  let n = 0;
  return () => `g${n++}`;
})();
const fresh = () => structuredClone(demo) as ProjectDoc;

describe('structural edits', () => {
  // protects=cascade confirm content; fails_when=an affected circuit is missing from the summary; no_claim=dialog UI
  it('lists every affected element before deleting a junction box', () => {
    expect(cascadeOf(fresh(), ['n_jb1'])).toEqual({
      nodeIds: ['n_jb1'],
      segmentIds: ['s01', 's02'],
      extraRunIds: [],
      panelIds: [],
      circuitIds: [],
    });
    expect(cascadeOf(fresh(), ['n_s1']).circuitIds).toEqual(['c2']);
  });

  // protects=structural delete semantics; fails_when=deleting a manual-route segment falls back to auto; no_claim=—
  it('keeps manual routes pointing at deleted segments so they show as invalid', () => {
    const d = fresh();
    d.circuits[1]!.routing = { mode: 'manual', segmentIds: ['s01', 's02'] };
    const summary = deleteElements(d, [], ['s02'], genId);
    expect(summary.circuitIds).toEqual(['c2']);
    expect(d.circuits[1]!.routing).toEqual({ mode: 'manual', segmentIds: ['s01', 's02'] });
    const warnings = runChecks(d, defaultProjectSettings(), createCatalogLookup());
    expect(warnings).toContainEqual(
      expect.objectContaining({ id: 'route_invalid', elementRef: { kind: 'circuit', id: 'c2' } }),
    );
  });

  // protects=panel delete; fails_when=circuits of a deleted panel vanish instead of becoming unprotected; no_claim=—
  it('deleting the panel leaves its circuits unprotected (check 3)', () => {
    const d = fresh();
    deleteElements(d, ['n_panel'], [], genId);
    expect(d.circuits).toHaveLength(3);
    const ids = runChecks(d, defaultProjectSettings(), createCatalogLookup()).map((w) => w.id);
    expect(ids).toContain('no_rcd');
    expect(projectDocSchema.safeParse(d).success).toBe(true);
  });

  // protects=floor delete cascade; fails_when=nodes, risers or targets of the deleted floor survive; no_claim=—
  it('deleting a floor removes its nodes, their segments and risers, and renumbers', () => {
    const d = fresh();
    deleteFloor(d, 'f1', genId);
    expect(d.floors.map((f) => [f.id, f.order])).toEqual([
      ['f0', 0],
      ['f2', 1],
    ]);
    expect(d.nodes.some((n) => n.floorId === 'f1')).toBe(false);
    expect(d.circuits.find((c) => c.id === 'c3')!.targetNodeIds).toEqual([]);
    // f0 and f2 are now adjacent: their riser points get linked.
    expect(d.segments.some((s) => [s.fromNodeId, s.toNodeId].sort().join() === 'n_r0,n_r2')).toBe(
      true,
    );
    expect(projectDocSchema.safeParse(d).success).toBe(true);
  });

  // protects=floor reorder; fails_when=orders are not contiguous after a move; no_claim=—
  it('moves a floor and keeps orders contiguous', () => {
    const d = fresh();
    moveFloor(d, 'f2', 0, genId);
    expect([...d.floors].sort((a, b) => a.order - b.order).map((f) => f.id)).toEqual([
      'f2',
      'f0',
      'f1',
    ]);
    expect(projectDocSchema.safeParse(d).success).toBe(true);
  });
});
