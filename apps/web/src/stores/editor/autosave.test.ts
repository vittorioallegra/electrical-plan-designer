import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRecoveryRepository } from '@/lib/repositories/recovery';
import { startAutosave, type Autosave } from './autosave';
import { saveStatusOf, type EditorInit, type EditorStore } from './editorStore';
import { demoStore } from '@/testing/editor';

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
  const { store } = demoStore(init);
  const recovery = createMemoryRecoveryRepository();
  const save = vi.spyOn(recovery, 'save');
  const clear = vi.spyOn(recovery, 'clear');
  autosave = startAutosave(store, {
    recovery,
    now: () => new Date('2026-10-26T10:00:00Z'),
  });
  return { store, recovery, save, clear };
}

describe('autosave', () => {
  // protects=debounce; fails_when=each keystroke writes the recovery copy; no_claim=exact timing in the browser
  it('debounces edits into one recovery write after 1 s', async () => {
    const { store, recovery, save } = await setup();
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(500);
    edit(store, 'b');
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    expect(saveStatusOf(store.getState())).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saveStatusOf(store.getState())).toBe('draft');
    expect(recovery.copy).toMatchObject({
      savedToFile: false,
      savedAt: '2026-10-26T10:00:00.000Z',
    });
    expect(recovery.copy!.project.doc.nodes[0]!.label).toBe('b');
  });

  // protects=AC 9 recovery follows the open project; fails_when=a project whose file has every change leaves a recovery copy, an edit does not write one bound to its file, or a save to the file does not clear it; no_claim=file writing (useSaveProject)
  it('keeps a copy only while the file lacks changes', async () => {
    const file = { path: 'a.epd', name: 'a.epd', stat: { mtimeMs: 1, size: 1 } };
    const { store, recovery, save, clear } = await setup({ file });
    await vi.advanceTimersByTimeAsync(0);
    // Opened from a file: nothing to recover.
    expect(save).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(1);
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(recovery.copy).toMatchObject({ savedToFile: false, file });
    store.getState().markSaved(store.getState().revision, file);
    await vi.advanceTimersByTimeAsync(0);
    expect(recovery.copy).toBeNull();
    expect(saveStatusOf(store.getState())).toBe('saved');
    // Later edits write a copy again.
    edit(store, 'b');
    await vi.advanceTimersByTimeAsync(1000);
    expect(recovery.copy!.project.doc.nodes[0]!.label).toBe('b');
  });

  // protects="Don't save"; fails_when=discarding leaves the copy, lets a pending edit write it back afterwards, or autosave keeps running; no_claim=the close dialog (WindowSync tests)
  it('discard deletes the copy and stops writing', async () => {
    const { store, recovery, save } = await setup({ status: 'unsaved' });
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(recovery.copy).not.toBeNull();
    edit(store, 'b');
    await autosave!.discard();
    expect(recovery.copy).toBeNull();
    const writes = save.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(writes);
    expect(recovery.copy).toBeNull();
  });

  // protects=no lost edit during a write; fails_when=an edit made while the copy is being written is never stored; no_claim=—
  it('writes again when an edit arrives during a write', async () => {
    const { store, recovery, save } = await setup();
    let release!: () => void;
    save.mockImplementationOnce(async (copy) => {
      await new Promise<void>((r) => (release = r));
      recovery.copy = structuredClone(copy);
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
    expect(recovery.copy!.project.doc.nodes[0]!.label).toBe('b');
  });

  // protects=recovery write failures; fails_when=a failed write looks stored, or is not retried on the next edit or on Retry; no_claim=UI text
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

  // protects=assets in the copy; fails_when=the copy misses a referenced asset or keeps one nothing references; no_claim=asset decoding
  it('stores only the assets the project references', async () => {
    const { store, recovery } = await setup();
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
    expect([...recovery.copy!.assets.keys()]).toEqual(['used']);
  });

  // protects=edits right before leaving the editor; fails_when=stopping autosave drops changes still waiting for the debounce; no_claim=closing the window (the close guard asks about unsaved changes)
  it('writes pending changes when stopped', async () => {
    const { store, recovery } = await setup();
    edit(store, 'last');
    autosave!.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(recovery.copy!.project.doc.nodes[0]!.label).toBe('last');
  });

  // protects=read-only docs; fails_when=a newer, read-only doc is written to the recovery copy; no_claim=—
  it('never writes a read-only project', async () => {
    const { save } = await setup({ readOnly: true, status: 'unsaved' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
