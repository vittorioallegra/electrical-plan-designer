import { describe, expect, it } from 'vitest';
import { CommandError } from './editorStore';
import { demoStore } from '@/testing/editor';

describe('editor store', () => {
  // protects=undo/redo of every document change; fails_when=undo does not restore the exact previous doc; no_claim=keyboard shortcuts
  it('undoes and redoes commands', async () => {
    const { store } = await demoStore();
    const before = store.getState().data;
    store.getState().applyCommand('rename', (d) => {
      d.doc.nodes[0]!.label = 'Main panel';
    });
    store.getState().applyCommand('slack', (d) => {
      d.settings.terminationSlack = 0.3;
    });
    expect(store.getState().data.doc.nodes[0]!.label).toBe('Main panel');
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().data).toEqual(before);
    store.getState().redo();
    expect(store.getState().data.doc.nodes[0]!.label).toBe('Main panel');
    expect(store.getState().data.settings.terminationSlack).toBe(0.2);
    expect(store.getState().future).toHaveLength(1);
  });

  // protects=command guards; fails_when=a command breaking doc integrity is applied; no_claim=UI message
  it('rejects commands that break the document', async () => {
    const { store } = await demoStore();
    const result = store.getState().applyCommand('self loop', (d) => {
      d.doc.segments[0]!.toNodeId = d.doc.segments[0]!.fromNodeId;
    });
    expect(result).toEqual({ ok: false, reason: 'segment from a node to itself' });
    expect(store.getState().revision).toBe(0);
    expect(
      store.getState().applyCommand('explicit', () => {
        throw new CommandError('nope');
      }),
    ).toEqual({ ok: false, reason: 'nope' });
  });

  // protects=dirty tracking; fails_when=an edit leaves the status "saved"; no_claim=—
  it('marks the store dirty and clears redo on a new command', async () => {
    const { store } = await demoStore();
    store.getState().applyCommand('a', (d) => void (d.doc.nodes[0]!.label = 'A'));
    store.getState().undo();
    store.getState().applyCommand('b', (d) => void (d.doc.nodes[0]!.label = 'B'));
    expect(store.getState().future).toEqual([]);
    expect(store.getState().saveStatus).toBe('dirty');
    expect(store.getState().revision).toBe(3);
  });

  // protects=read-only newer docs; fails_when=a read-only doc accepts edits; no_claim=—
  it('refuses commands when read-only', async () => {
    const { store } = await demoStore();
    store.setState({ readOnly: true });
    expect(store.getState().applyCommand('x', (d) => void (d.doc.nodes[0]!.label = 'X')).ok).toBe(
      false,
    );
  });

  // protects=selection hygiene; fails_when=undo leaves a deleted element selected; no_claim=—
  it('drops deleted elements from the selection', async () => {
    const { store } = await demoStore();
    store.getState().setUi({ selection: ['n_s3'] });
    store.getState().applyCommand('delete', (d) => {
      d.doc.segments = d.doc.segments.filter((s) => s.id !== 's10');
      d.doc.nodes = d.doc.nodes.filter((n) => n.id !== 'n_s3');
    });
    expect(store.getState().ui.selection).toEqual([]);
  });

  // protects=issued quotes outside undo; fails_when=undo removes an issued quote or issuing is not saved; no_claim=numbering (repository)
  it('keeps issued quotes when undoing quote setting edits', async () => {
    const { store } = await demoStore();
    store.getState().applyCommand('vat', (d) => {
      d.quote.settings.vatPercent = 10;
    });
    const issued = {
      number: 1,
      issuedAt: '2026-10-25T10:00:00.000Z',
      language: 'en',
      lines: [],
      settings: store.getState().data.quote.settings,
      totals: {
        materialsBeforeAdjustment: 0,
        adjustment: 0,
        materials: 0,
        labor: 0,
        taxable: 0,
        vat: 0,
        total: 0,
        unpricedCount: 0,
      },
    };
    expect(store.getState().appendIssuedQuote(issued)).toEqual({ ok: true });
    expect(store.getState().saveStatus).toBe('dirty');
    store.getState().undo();
    expect(store.getState().data.quote.settings.vatPercent).toBe(22);
    expect(store.getState().data.quote.issued).toEqual([issued]);
    store.getState().redo();
    expect(store.getState().data.quote.issued).toHaveLength(1);
  });
});
