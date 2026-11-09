import { describe, expect, it } from 'vitest';
import demo from '../../../tests/fixtures/demo-project.json';
import { runChecks } from './checks';
import { createCatalogLookup } from './catalog/lookup';
import { defaultProjectSettings } from './defaults';
import { copyNodes, moveNodes, pasteNodes } from './edits';
import { segmentLengths } from './lengths';
import { routeDoc } from './routing';
import { docIntegrityIssues } from './schema';
import {
  addToColumn,
  columnMembers,
  rebuildStacks,
  sameHeightColumnNodeIds,
  takeOutOfColumn,
} from './stacks';
import { circuit, floor, node, panel, seg } from './testing/builders';
import type { ProjectDoc } from './types';

const ids = () => {
  let n = 0;
  return () => `new${n++}`;
};

const settings = defaultProjectSettings();

/** Panel P, a switch box SW at (2, 0) and a socket box SO in its column. */
function columnDoc(): ProjectDoc {
  return {
    schemaVersion: 1,
    floors: [floor('f0', 0)],
    nodes: [
      node('P', 'f0', 'panel', 0, 0),
      node('SW', 'f0', 'terminal_box', 2, 0, { mounting: 'switch', stackId: 'k' }),
      node('SO', 'f0', 'terminal_box', 2, 0, { mounting: 'socket', stackId: 'k' }),
    ],
    segments: [seg('s1', 'P', 'SW')],
    panels: [panel('P')],
    circuits: [],
    extraRuns: [],
  } as unknown as ProjectDoc;
}

const vertical = (d: ProjectDoc) =>
  d.segments.filter((s) => s.id !== 's1').map((s) => [s.fromNodeId, s.toNodeId, s.runElevation]);

describe('rebuildStacks', () => {
  // protects=derived vertical conduit; fails_when=a column gets no segment, more than one per neighbour pair, or one that is not direct from the upper to the lower box; no_claim=UI
  it('adds one direct segment between neighbours, top to bottom', () => {
    const d = columnDoc();
    expect(rebuildStacks(d, settings, ids())).toEqual([]);
    expect(vertical(d)).toEqual([['SW', 'SO', 'direct']]);
    expect(rebuildStacks(d, settings, ids())).toEqual([]);
    expect(vertical(d)).toHaveLength(1);
    expect(columnMembers(d, settings, 'k').map((n) => n.id)).toEqual(['SW', 'SO']);
  });

  // protects=idempotence (no undo noise); fails_when=a consistent doc changes on rebuild; no_claim=—
  it('leaves a consistent doc unchanged', () => {
    const d = columnDoc();
    rebuildStacks(d, settings, ids());
    const before = structuredClone(d);
    rebuildStacks(d, settings, ids());
    expect(d).toEqual(before);
    const plain = structuredClone(demo) as ProjectDoc;
    expect(rebuildStacks(plain, settings, ids())).toEqual([]);
    expect(plain).toEqual(demo);
  });

  // protects=reordering by height; fails_when=a box moved above another keeps the old chain, the conduit item is lost, or removed ids are not reported; no_claim=manual route repair
  it('rechains the column when heights change, keeping the conduit item', () => {
    const d = columnDoc();
    d.nodes.push(node('J', 'f0', 'junction_box', 2, 0, { stackId: 'k', customHeight: 2.3 }));
    rebuildStacks(d, settings, ids());
    expect(vertical(d)).toEqual([
      ['J', 'SW', 'direct'],
      ['SW', 'SO', 'direct'],
    ]);
    for (const s of d.segments) if (s.id !== 's1') s.conduitItemId = 'builtin:conduit_25';
    d.nodes.find((n) => n.id === 'SO')!.customHeight = 1.4;
    const removed = rebuildStacks(d, settings, ids());
    expect(removed).toHaveLength(1);
    expect(
      vertical(d)
        .map(([a, b]) => [a, b].sort().join('-'))
        .sort(),
    ).toEqual(['J-SO', 'SO-SW']);
    expect(d.segments.every((s) => s.id === 's1' || s.conduitItemId === 'builtin:conduit_25')).toBe(
      true,
    );
  });

  // protects=dissolving a column; fails_when=a column of one keeps its stackId or its vertical segment; no_claim=—
  it('dissolves a column left with one box', () => {
    const d = columnDoc();
    rebuildStacks(d, settings, ids());
    d.nodes = d.nodes.filter((n) => n.id !== 'SO');
    d.segments = d.segments.filter((s) => s.toNodeId !== 'SO');
    rebuildStacks(d, settings, ids());
    expect(d.nodes.find((n) => n.id === 'SW')!.stackId).toBeUndefined();
    expect(docIntegrityIssues(d)).toEqual([]);
  });

  // protects=chained only; fails_when=a hand-drawn conduit between non-neighbours of a column survives; no_claim=—
  it('removes segments between boxes of a column that are not neighbours', () => {
    const d = columnDoc();
    d.nodes.push(node('J', 'f0', 'junction_box', 2, 0, { stackId: 'k', customHeight: 2.3 }));
    d.segments.push(seg('hand', 'J', 'SO', { vertices: [{ x: 3, y: 1 }] }));
    expect(rebuildStacks(d, settings, ids())).toContain('hand');
    expect(vertical(d)).toHaveLength(2);
  });
});

describe('column lengths, routing and checks', () => {
  // protects=AC 1-2 vertical conduit in lengths and routes; fails_when=the vertical conduit is not switch minus socket height or a circuit to the socket box skips it; no_claim=cable waste
  it('measures the vertical conduit and routes through it', () => {
    const d = columnDoc();
    rebuildStacks(d, settings, ids());
    const lengths = segmentLengths(d, settings);
    const verticalId = d.segments.find((s) => s.id !== 's1')!.id;
    expect(lengths.get(verticalId)).toBe(800);
    d.circuits.push(circuit('c', 'mcb16', ['SO']));
    const route = routeDoc(d, settings).circuitRoutes.get('c');
    expect(route?.ok && route.segmentIds).toContain(verticalId);
  });

  // protects=AC 8; fails_when=two boxes of a column at one height raise no warning; no_claim=—
  it('warns about two boxes of a column at the same height', () => {
    const d = columnDoc();
    d.nodes.find((n) => n.id === 'SO')!.mounting = 'switch';
    rebuildStacks(d, settings, ids());
    expect(sameHeightColumnNodeIds(d, settings).sort()).toEqual(['SO', 'SW']);
    const warnings = runChecks(d, settings, createCatalogLookup([]));
    expect(warnings.filter((w) => w.id === 'stack_same_height')).toHaveLength(2);
  });
});

describe('column edits', () => {
  // protects=AC 5 move; fails_when=moving one box leaves the rest of its column behind; no_claim=drag UI
  it('moves the whole column', () => {
    const d = columnDoc();
    moveNodes(d, ['SO'], { x: 1, y: 1 });
    expect(d.nodes.filter((n) => n.stackId === 'k').map((n) => n.position)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 1 },
    ]);
    expect(docIntegrityIssues(d)).toEqual([]);
  });

  // protects=AC 7 paste; fails_when=a pasted column shares the original stackId or a lone pasted box stays in a column; no_claim=—
  it('pastes a column as a new column, a lone box as a plain box', () => {
    const d = columnDoc();
    rebuildStacks(d, settings, ids());
    const gen = ids();
    const pasted = pasteNodes(d, copyNodes(d, ['SW', 'SO']), 'f0', { x: 0, y: 2 }, gen);
    const stacks = new Set(pasted.map((id) => d.nodes.find((n) => n.id === id)!.stackId));
    expect(stacks.size).toBe(1);
    expect(stacks.has('k')).toBe(false);
    const lone = pasteNodes(d, copyNodes(d, ['SO']), 'f0', { x: 0, y: 4 }, gen);
    rebuildStacks(d, settings, gen);
    expect(d.nodes.find((n) => n.id === lone[0])!.stackId).toBeUndefined();
    expect(docIntegrityIssues(d)).toEqual([]);
  });

  // protects=add and take out; fails_when=a box added to a column is not at its point or a box taken out keeps its stackId; no_claim=—
  it('adds a box to a column and takes it out again', () => {
    const d = columnDoc();
    d.nodes.find((n) => n.id === 'SO')!.stackId = undefined;
    d.nodes.find((n) => n.id === 'SW')!.stackId = undefined;
    d.nodes = d.nodes.filter((n) => n.id !== 'SO');
    const gen = ids();
    const box = node('SO', 'f0', 'terminal_box', 9, 9, { mounting: 'socket' });
    expect(addToColumn(d, 'SW', box, gen)).toBe(true);
    expect(box.position).toEqual({ x: 2, y: 0 });
    expect(box.stackId).toBe(d.nodes.find((n) => n.id === 'SW')!.stackId);
    expect(addToColumn(d, 'P', node('X', 'f0', 'terminal_box', 0, 0), gen)).toBe(false);
    expect(takeOutOfColumn(d, 'SO', { x: 0.3, y: 0 })).toBe(true);
    rebuildStacks(d, settings, gen);
    expect(d.nodes.every((n) => n.stackId === undefined)).toBe(true);
    expect(d.nodes.find((n) => n.id === 'SO')!.position).toEqual({ x: 2.3, y: 0 });
  });

  // protects=schema invariants; fails_when=a column with boxes apart, a stacked panel or a column of one passes validation; no_claim=—
  it('rejects broken columns', () => {
    const apart = columnDoc();
    apart.nodes.find((n) => n.id === 'SO')!.position = { x: 3, y: 0 };
    expect(docIntegrityIssues(apart).map((i) => i.message)).toContain('column boxes apart');
    const panelIn = columnDoc();
    panelIn.nodes.find((n) => n.id === 'P')!.stackId = 'k';
    expect(docIntegrityIssues(panelIn).map((i) => i.message)).toContain(
      'only boxes can be stacked',
    );
    const single = columnDoc();
    single.nodes = single.nodes.filter((n) => n.id !== 'SO');
    expect(docIntegrityIssues(single).map((i) => i.message)).toContain('column of one box');
  });
});
