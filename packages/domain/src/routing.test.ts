import { describe, expect, it } from 'vitest';
import { defaultProjectSettings } from './defaults';
import { routeDoc, splitSegment, validateManualRoute, type RouteResult } from './routing';
import { ac4Doc, circuit, doc, extraRun, node, panel, seg } from './testing/builders';
import type { ProjectDoc } from './types';

const settings = defaultProjectSettings();

function okSegments(result: RouteResult | undefined): string[] {
  if (!result?.ok) throw new Error(`route failed: ${JSON.stringify(result)}`);
  return result.segmentIds;
}

function conductorsIn(d: ProjectDoc, segmentId: string) {
  return routeDoc(d, settings).occupancy.get(segmentId) ?? [];
}

/**
 * P ─T─ J ─a─ A        trunk T shared by two branches to A and B,
 *        └─b─ B        plus a long detour P ─L─ B.
 */
function trunkDoc(): ProjectDoc {
  return doc({
    nodes: [
      node('P', 'f0', 'panel', 0, 0),
      node('J', 'f0', 'junction_box', 4, 0),
      node('A', 'f0', 'terminal_box', 4, 3, { mounting: 'socket' }),
      node('B', 'f0', 'terminal_box', 8, 0, { mounting: 'socket' }),
    ],
    segments: [
      seg('T', 'P', 'J'),
      seg('a', 'J', 'A'),
      seg('b', 'J', 'B'),
      seg('L', 'P', 'B', {
        vertices: [
          { x: 0, y: 10 },
          { x: 8, y: 10 },
        ],
      }),
    ],
    panels: [panel('P')],
  });
}

describe('auto routing', () => {
  // protects=AC 6 auto routing; fails_when=auto routing takes the longer detour; no_claim=real cable paths
  it('AC 6: picks the shortest path', () => {
    const d = trunkDoc();
    d.circuits = [circuit('c', 'mcb16', ['B'])];
    expect(okSegments(routeDoc(d, settings).circuitRoutes.get('c'))).toEqual(['T', 'b']);
  });

  // protects=AC 5 shared trunk once per circuit; fails_when=a one-circuit trunk is counted twice; no_claim=BOM math
  it('AC 5: one circuit to two boxes counts the shared trunk once', () => {
    const d = trunkDoc();
    d.circuits = [circuit('c', 'mcb16', ['A', 'B'])];
    expect(okSegments(routeDoc(d, settings).circuitRoutes.get('c'))).toEqual(['T', 'a', 'b']);
    expect(conductorsIn(d, 'T')).toHaveLength(3);
  });

  // protects=AC 5 two circuits in one trunk; fails_when=the second circuit's conductors are missing from the trunk; no_claim=—
  it('AC 5: two circuits sharing a trunk both occupy it', () => {
    const d = trunkDoc();
    d.circuits = [circuit('c1', 'mcb16', ['A']), circuit('c2', 'mcb10', ['B'])];
    const inTrunk = conductorsIn(d, 'T');
    expect(inTrunk).toHaveLength(6);
    expect(new Set(inTrunk.map((c) => c.owner.id))).toEqual(new Set(['c1', 'c2']));
  });

  // protects=deterministic ties; fails_when=equal-length alternatives depend on array order; no_claim=which branch is "better"
  it('breaks equal-length ties by segment id, whatever the array order', () => {
    const square = (order: string[]) => {
      const all = {
        x1: seg('x1', 'P', 'U'),
        x2: seg('x2', 'U', 'T'),
        y1: seg('y1', 'P', 'D'),
        y2: seg('y2', 'D', 'T'),
      };
      return doc({
        nodes: [
          node('P', 'f0', 'panel', 0, 0),
          node('U', 'f0', 'junction_box', 2, 2),
          node('D', 'f0', 'junction_box', 2, -2),
          node('T', 'f0', 'junction_box', 4, 0),
        ],
        segments: order.map((k) => all[k as keyof typeof all]),
        panels: [panel('P')],
        circuits: [circuit('c', 'mcb16', ['T'])],
      });
    };
    const a = okSegments(
      routeDoc(square(['x1', 'x2', 'y1', 'y2']), settings).circuitRoutes.get('c'),
    );
    const b = okSegments(
      routeDoc(square(['y2', 'y1', 'x2', 'x1']), settings).circuitRoutes.get('c'),
    );
    expect(a).toEqual(b);
    expect(a).toEqual(['x1', 'x2']);
  });

  // protects=unreachable target reporting; fails_when=a disconnected target is silently dropped; no_claim=UI message
  it('reports disconnected targets and routes the rest', () => {
    const d = trunkDoc();
    d.nodes.push(node('Z', 'f0', 'terminal_box', 20, 20));
    d.circuits = [circuit('c', 'mcb16', ['A', 'Z'])];
    const route = routeDoc(d, settings).circuitRoutes.get('c');
    expect(route).toEqual({ ok: true, segmentIds: ['T', 'a'], unreachableTargetIds: ['Z'] });
  });

  // protects=AC 7 extra runs; fails_when=traveler conductors are not added to their path; no_claim=BOM totals
  it('AC 7: extra conductor runs occupy their path', () => {
    const d = trunkDoc();
    d.extraRuns = [extraRun('x', 'A', 'B')];
    const routes = routeDoc(d, settings);
    expect(okSegments(routes.extraRunRoutes.get('x'))).toEqual(['a', 'b']);
    expect(routes.occupancy.get('a')!.map((c) => c.color)).toEqual(['black', 'grey']);
    expect(routes.occupancy.get('T')).toEqual([]);
  });
});

describe('manual routing', () => {
  const route = (d: ProjectDoc, ids: string[], targets: string[]) =>
    validateManualRoute(d, ids, 'P', targets);

  // protects=AC 6 manual chain; fails_when=a valid panel→target chain is rejected; no_claim=—
  it('AC 6: accepts a contiguous chain from panel to target', () => {
    expect(route(trunkDoc(), ['L'], ['B'])).toEqual({
      ok: true,
      segmentIds: ['L'],
      unreachableTargetIds: [],
    });
  });

  // protects=two-target manual trees; fails_when=a tree reaching both targets is rejected; no_claim=—
  it('accepts a tree reaching two targets', () => {
    expect(route(trunkDoc(), ['T', 'a', 'b'], ['A', 'B']).ok).toBe(true);
  });

  // protects=manual validation; fails_when=a non-contiguous selection is accepted; no_claim=—
  it('rejects an unreached target', () => {
    expect(route(trunkDoc(), ['a'], ['A'])).toMatchObject({
      ok: false,
      problem: 'unreached_target',
      nodeIds: ['A'],
    });
  });

  // protects=manual validation; fails_when=a branch to nowhere is accepted; no_claim=—
  it('rejects a dead-end segment', () => {
    expect(route(trunkDoc(), ['T', 'a', 'b'], ['A'])).toMatchObject({
      ok: false,
      problem: 'dead_end',
      segmentIds: ['b'],
    });
  });

  // protects=manual validation; fails_when=a loop is accepted (double counting); no_claim=—
  it('rejects a cycle', () => {
    expect(route(trunkDoc(), ['T', 'b', 'L'], ['B'])).toMatchObject({
      ok: false,
      problem: 'cycle',
    });
  });

  // protects=manual validation; fails_when=two parallel segments between the same nodes pass; no_claim=—
  it('rejects a parallel duplicate', () => {
    const d = trunkDoc();
    d.segments.push(seg('T2', 'P', 'J'));
    expect(route(d, ['T', 'T2', 'a'], ['A'])).toMatchObject({ ok: false, problem: 'cycle' });
  });

  // protects=structural delete; fails_when=a deleted segment silently falls back to auto; no_claim=cascade dialog
  it('invalidates a manual route whose segment was deleted', () => {
    const d = trunkDoc();
    d.circuits = [
      circuit('c', 'mcb16', ['A'], { routing: { mode: 'manual', segmentIds: ['T', 'a'] } }),
    ];
    d.segments = d.segments.filter((s) => s.id !== 'a');
    const result = routeDoc(d, settings);
    expect(result.circuitRoutes.get('c')).toMatchObject({ ok: false, problem: 'missing_segment' });
    expect(result.occupancy.get('T')).toEqual([]);
  });

  // protects=split-segment command; fails_when=inserting a junction box breaks manual routes; no_claim=UI placement
  it('split keeps manual routes valid and preserves length', () => {
    const d = ac4Doc();
    d.segments[0]!.vertices = [
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ];
    d.circuits[0]!.routing = { mode: 'manual', segmentIds: ['S1', 'S2'] };
    splitSegment(d, 'S1', node('N', 'f0', 'junction_box', 3, 0), 1, ['S1a', 'S1b']);
    expect(d.segments.map((s) => s.id)).toEqual(['S1a', 'S1b', 'S2']);
    expect(d.segments[0]!.vertices).toEqual([{ x: 2, y: 0 }]);
    expect(d.segments[1]!.vertices).toEqual([{ x: 4, y: 0 }]);
    expect(d.circuits[0]!.routing).toEqual({ mode: 'manual', segmentIds: ['S1a', 'S1b', 'S2'] });
    expect(routeDoc(d, settings).circuitRoutes.get('c1')?.ok).toBe(true);
  });
});

describe('risers in routing', () => {
  // protects=AC 10 riser conductors; fails_when=a circuit to the upper floor skips the riser; no_claim=—
  it('routes through a riser to the upper floor', async () => {
    const demo = (await import('../../../tests/fixtures/demo-project.json')).default as ProjectDoc;
    const result = routeDoc(demo, settings);
    expect(okSegments(result.circuitRoutes.get('c3'))).toEqual(['s05', 's06', 's07', 's08']);
    expect(result.occupancy.get('s06')).toHaveLength(3);
  });
});
