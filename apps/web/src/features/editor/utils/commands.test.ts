import { describe, expect, it } from 'vitest';
import { demoStore } from '@/testing/editor';
import {
  addConduit,
  addConduitToNewJunction,
  copySelection,
  deleteIds,
  moveSelection,
  pasteClipboard,
  placeNode,
} from './commands';

describe('plan commands', () => {
  // protects=one panel per project in v1; fails_when=a second panel can be placed or the first lacks a Panel entry; no_claim=sub-panels
  it('placing a panel creates its Panel entry, only once', async () => {
    const { store } = demoStore();
    store.getState().applyCommand('clear', (d) => {
      d.doc.panels = [];
    });
    const id = placeNode(store, 'panel', { x: 20, y: 20 })!;
    expect(store.getState().data.doc.panels).toMatchObject([
      { nodeId: id, dinRails: 1, modulesPerRail: 12 },
    ]);
    expect(placeNode(store, 'panel', { x: 25, y: 20 })).toBeNull();
  });

  // protects=split on placement; fails_when=a junction box dropped on a segment does not split it; no_claim=—
  it('a junction box dropped on a segment splits it', async () => {
    const { store } = demoStore();
    const id = placeNode(store, 'junction_box', { x: 2.5, y: 0.01 }, 's01')!;
    const doc = store.getState().data.doc;
    expect(doc.nodes.find((n) => n.id === id)!.position).toEqual({ x: 2.5, y: 0 });
    expect(doc.segments.some((s) => s.id === 's01')).toBe(false);
    expect(doc.segments.filter((s) => s.fromNodeId === id || s.toNodeId === id)).toHaveLength(2);
  });

  // protects=conduit tool results; fails_when=ending on empty space does not create a junction box; no_claim=pointer handling
  it('draws conduits between nodes and to a new junction box', async () => {
    const { store } = demoStore();
    const segId = addConduit(store, 'n_s1', 'n_sw1', [{ x: 1, y: 3 }])!;
    expect(store.getState().data.doc.segments.find((s) => s.id === segId)).toMatchObject({
      runElevation: 'floor',
      vertices: [{ x: 1, y: 3 }],
    });
    const jb = addConduitToNewJunction(store, 'n_s1', [
      { x: 6, y: 3 },
      { x: 6, y: 4 },
    ])!;
    const doc = store.getState().data.doc;
    expect(doc.nodes.find((n) => n.id === jb)).toMatchObject({
      kind: 'junction_box',
      position: { x: 6, y: 4 },
    });
    expect(doc.segments.find((s) => s.toNodeId === jb)!.vertices).toEqual([{ x: 6, y: 3 }]);
  });

  // protects=undoable bulk edits; fails_when=move, duplicate, paste or delete take more than one undo; no_claim=—
  it('moves, duplicates, pastes and deletes in single undo steps', async () => {
    const { store } = demoStore();
    const before = store.getState().data.doc;
    moveSelection(store, ['n_s1'], { x: 1, y: 0 }, false);
    moveSelection(store, ['n_s1'], { x: 0, y: 1 }, true);
    store.getState().setUi({ selection: ['n_jb1', 'n_s1'] });
    expect(copySelection(store)).toBe(2);
    expect(pasteClipboard(store)).toHaveLength(2);
    deleteIds(store, ['n_jb1']);
    const s = store.getState();
    expect(s.past.map((p) => p.label)).toEqual(['move', 'duplicate', 'paste', 'delete']);
    for (let i = 0; i < 4; i++) store.getState().undo();
    expect(store.getState().data.doc).toEqual(before);
  });
});

describe('box presets on placement', () => {
  // protects=presets applied on placement; fails_when=a placed box ignores the active preset; no_claim=preset storage
  it('places a terminal box with the preset box, mounting and contents', async () => {
    const { store } = demoStore();
    const id = placeNode(store, 'terminal_box', { x: 30, y: 30 }, undefined, {
      id: 'p1',
      name: 'Switch 503',
      mounting: 'switch',
      boxItemId: 'builtin:box_503',
      contents: [{ itemId: 'builtin:switch', qty: 1 }],
    })!;
    expect(store.getState().data.doc.nodes.find((n) => n.id === id)).toMatchObject({
      mounting: 'switch',
      boxItemId: 'builtin:box_503',
      contents: [{ itemId: 'builtin:switch', qty: 1 }],
    });
  });
});
