import { describe, expect, it } from 'vitest';
import demo from '../../tests/fixtures/demo-project.json';
import { createCatalogLookup } from './catalog/lookup';
import { runChecks } from './checks';
import { defaultProjectSettings } from './defaults';
import {
  cascadeOf,
  copyNodes,
  deleteElements,
  deleteFloor,
  linkRiser,
  moveFloor,
  moveNodes,
  nextNodeLabel,
  pasteNodes,
  unlinkRiser,
} from './edits';
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

describe('node edits', () => {
  // protects=move keeps conduit shape; fails_when=moving both ends leaves vertices behind; no_claim=snapping
  it('moves nodes and the vertices of segments between them', () => {
    const d = fresh();
    moveNodes(d, ['n_jb1', 'n_s1'], { x: 1, y: 0 });
    expect(d.nodes.find((n) => n.id === 'n_s1')!.position).toEqual({ x: 6, y: 3 });
    expect(d.segments.find((s) => s.id === 's02')!.vertices).toEqual([{ x: 6, y: 1.5 }]);
    // s01 has only one moved end: no vertices to move, the end follows the node by reference.
    expect(d.segments.find((s) => s.id === 's01')!.vertices).toEqual([]);
  });

  // protects=copy/paste; fails_when=pasted boxes share ids or risers stay linked; no_claim=clipboard API
  it('copies and pastes nodes with contents and inner segments, risers unlinked', () => {
    const d = fresh();
    const clip = copyNodes(d, ['n_jb1', 'n_s1', 'n_r0', 'n_panel']);
    expect(clip.nodes.map((n) => n.id)).toEqual(['n_jb1', 'n_s1', 'n_r0']);
    expect(clip.segments.map((s) => s.id)).toEqual(['s02']);
    const created = pasteNodes(d, clip, 'f0', { x: 0.5, y: 0.5 }, genId);
    const pasted = d.nodes.filter((n) => created.includes(n.id));
    expect(pasted.find((n) => n.label === 'Kitchen socket')!.contents).toHaveLength(3);
    expect(pasted.find((n) => n.kind === 'riser_point')!.riserGroupId).not.toBe('rg1');
    expect(projectDocSchema.safeParse(d).success).toBe(true);
  });

  // protects=riser linking; fails_when=linking does not create the riser point and segment; no_claim=—
  it('links a riser point to the floor above and creates the riser segment', () => {
    const d = fresh();
    d.nodes.push({
      id: 'rx',
      floorId: 'f1',
      kind: 'riser_point',
      position: { x: 2, y: 2 },
      label: 'R9',
      status: 'active',
    });
    const above = linkRiser(d, 'rx', 'up', genId)!;
    expect(d.nodes.find((n) => n.id === above)).toMatchObject({
      floorId: 'f2',
      position: { x: 2, y: 2 },
    });
    expect(
      d.segments.some(
        (s) => [s.fromNodeId, s.toNodeId].sort().join() === [above, 'rx'].sort().join(),
      ),
    ).toBe(true);
    expect(linkRiser(d, above, 'up', genId)).toBeNull();
    const removed = unlinkRiser(d, above, genId);
    expect(removed).toHaveLength(1);
  });

  // protects=default labels; fails_when=a new box reuses an existing label number; no_claim=—
  it('numbers default labels per kind', () => {
    const d = fresh();
    expect(nextNodeLabel(d, 'junction_box')).toBe('J1');
    d.nodes.push({ ...d.nodes[1]!, id: 'x', label: 'J7' });
    expect(nextNodeLabel(d, 'junction_box')).toBe('J8');
  });
});
