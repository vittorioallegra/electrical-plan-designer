import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDraftRepository } from '@/lib/repositories/drafts';
import { startAutosave, type Autosave } from './autosave';
import { saveStatusOf, type EditorInit, type EditorStore } from './editorStore';
import { DEMO_ID, demoStore } from '@/testing/editor';

const edit = (store: EditorStore, label: string) =>
  store.getState().applyCommand(label, (d) => {
    d.doc.nodes[0]!.label = label;
  });

let autosave: Autosave | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  autosave?.stop();
  vi.useRealTimers();
});

async function setup(init: Partial<EditorInit> = {}) {
  const { store } = await demoStore(init);
  const drafts = createMemoryDraftRepository();
  const save = vi.spyOn(drafts, 'save');
  const target = new EventTarget();
  autosave = startAutosave(store, {
    drafts,
    target: target as unknown as Window,
    now: () => new Date('2026-10-26T10:00:00Z'),
  });
  return { store, drafts, save, target };
}

describe('autosave', () => {
  // protects=debounce; fails_when=each keystroke writes the draft; no_claim=exact timing in the browser
  it('debounces edits into one draft write after 1 s', async () => {
    const { store, drafts, save } = await setup();
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(500);
    edit(store, 'b');
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    expect(saveStatusOf(store.getState())).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saveStatusOf(store.getState())).toBe('draft');
    expect(drafts.draft).toMatchObject({
      savedToFile: false,
      savedAt: '2026-10-26T10:00:00.000Z',
      recordId: DEMO_ID,
    });
    expect(drafts.draft!.project.doc.nodes[0]!.label).toBe('b');
  });

  // protects=no lost edit during a write; fails_when=an edit made while the draft is being written is never stored; no_claim=—
  it('writes again when an edit arrives during a write', async () => {
    const { store, drafts, save } = await setup();
    let release!: () => void;
    save.mockImplementationOnce(async (draft) => {
      await new Promise<void>((r) => (release = r));
      drafts.draft = structuredClone(draft);
    });
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    edit(store, 'b');
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(saveStatusOf(store.getState())).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(saveStatusOf(store.getState())).toBe('draft');
    expect(drafts.draft!.project.doc.nodes[0]!.label).toBe('b');
  });

  // protects=draft write failures; fails_when=a failed write looks stored, or is not retried on the next edit or on Retry; no_claim=UI text
  it('flags a failed write and retries on the next edit or flush', async () => {
    const { store, save } = await setup();
    save.mockRejectedValueOnce(new Error('quota')).mockRejectedValueOnce(new Error('quota'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState()).toMatchObject({ draftFailed: true });
    expect(saveStatusOf(store.getState())).toBe('unsaved');
    edit(store, 'b');
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    autosave!.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState()).toMatchObject({ draftFailed: false });
    expect(saveStatusOf(store.getState())).toBe('draft');
  });

  // protects=assets in the draft; fails_when=the draft misses a referenced asset or keeps one nothing references; no_claim=asset decoding
  it('stores only the assets the project references', async () => {
    const { store, drafts } = await setup();
    const png = { mimeType: 'image/png' as const, bytes: new Uint8Array([1, 2]) };
    store.getState().addAsset('used', png);
    store.getState().addAsset('unused', png);
    store.getState().applyCommand('bg', (d) => {
      d.doc.floors[0]!.background = {
        assetId: 'used',
        kind: 'image',
        widthPx: 2,
        heightPx: 1,
        offset: { x: 0, y: 0 },
        rotation: 0,
        opacity: 0.4,
      };
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect([...drafts.draft!.assets.keys()]).toEqual(['used']);
  });

  // protects=edits right before leaving the editor; fails_when=stopping autosave drops changes still waiting for the debounce; no_claim=tab close (beforeunload)
  it('writes pending changes when stopped', async () => {
    const { store, drafts } = await setup();
    edit(store, 'last');
    autosave!.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(drafts.draft!.project.doc.nodes[0]!.label).toBe('last');
  });

  // protects=read-only docs; fails_when=a newer, read-only doc is written to the draft; no_claim=—
  it('never writes a read-only project', async () => {
    const { save } = await setup({ readOnly: true, status: 'unsaved' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  // protects=beforeunload guard; fails_when=closing the tab with changes not in the draft gives no warning, or it warns once they are stored; no_claim=browser dialog text
  it('guards beforeunload while changes are not in the draft', async () => {
    const { store, target } = await setup();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    edit(store, 'a');
    expect(unload()).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(unload()).toBe(false);
  });
});
