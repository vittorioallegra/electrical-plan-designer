import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveError } from '@/data/types';
import { startAutosave, type Autosave } from './autosave';
import type { EditorStore } from './editorStore';
import { demoStore } from './testing';
import { createMemoryUnsavedStore, shouldOfferRestore } from './unsavedStore';

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

async function setup() {
  const ctx = await demoStore();
  const unsaved = createMemoryUnsavedStore();
  const target = new EventTarget();
  autosave = startAutosave(ctx.store, {
    projects: ctx.repos.projects,
    auth: ctx.repos.auth,
    unsaved,
    target: target as unknown as Window,
  });
  return { ...ctx, unsaved, target };
}

describe('autosave', () => {
  // protects=debounce; fails_when=each keystroke triggers a save; no_claim=exact timing in the browser
  it('debounces edits into one save after 1 s', async () => {
    const { store, control } = await setup();
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(500);
    edit(store, 'b');
    await vi.advanceTimersByTimeAsync(999);
    expect(control.saveCalls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(control.saveCalls).toHaveLength(1);
    expect(store.getState().saveStatus).toBe('saved');
    expect(store.getState().version).toBe(2);
  });

  // protects=no self-conflict; fails_when=an edit during an in-flight save causes a version_conflict; no_claim=—
  it('an edit during an in-flight save leads to a second save, no conflict', async () => {
    const { store, control } = await setup();
    let release!: () => void;
    control.beforeSave = () => new Promise<void>((r) => (release = r));
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().saveStatus).toBe('saving');
    edit(store, 'b');
    control.beforeSave = undefined;
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().saveStatus).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1000);
    expect(control.saveCalls.map((c) => c.expectedVersion)).toEqual([1, 2]);
    expect(store.getState().saveStatus).toBe('saved');
    expect(control.projects.get(store.getState().projectId)!.doc).toMatchObject({
      nodes: expect.arrayContaining([expect.objectContaining({ label: 'b' })]),
    });
  });

  // protects=network retry; fails_when=a transient failure loses the save or retries forever; no_claim=—
  it('retries network errors 3 times, then waits for online or the next edit', async () => {
    const { store, control, target } = await setup();
    control.beforeSave = () => {
      throw new SaveError('network');
    };
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000 + 1000 + 2000 + 4000);
    expect(control.saveCalls).toHaveLength(4);
    expect(store.getState()).toMatchObject({ saveStatus: 'error', saveError: 'network' });
    control.beforeSave = undefined;
    target.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().saveStatus).toBe('saved');
  });

  // protects=conflict handling; fails_when=a stale save overwrites newer data or autosave keeps retrying; no_claim=dialog UI
  it('stops on version_conflict', async () => {
    const { store, control } = await setup();
    control.projects.get(store.getState().projectId)!.meta.version = 5;
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState()).toMatchObject({
      saveStatus: 'conflict',
      saveError: 'version_conflict',
    });
    edit(store, 'b');
    await vi.advanceTimersByTimeAsync(5000);
    expect(control.saveCalls).toHaveLength(1);
  });

  // protects=auth expiry; fails_when=an expired session silently drops edits or never retries; no_claim=login UI
  it('auth_expired waits for a new session, then saves', async () => {
    const { store, control, repos } = await setup();
    control.expireSession();
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState()).toMatchObject({ saveStatus: 'error', saveError: 'auth_expired' });
    await repos.auth.signIn('dev@example.test', 'devpassword');
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().saveStatus).toBe('saved');
  });

  // protects=non-retryable errors; fails_when=forbidden or invalid_doc are retried in a loop; no_claim=—
  it.each(['forbidden', 'invalid_doc'] as const)('%s is an error without retry', async (code) => {
    const { store, control } = await setup();
    control.beforeSave = () => {
      throw new SaveError(code);
    };
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(control.saveCalls).toHaveLength(1);
    expect(store.getState()).toMatchObject({ saveStatus: 'error', saveError: code });
  });

  // protects=offline loss; fails_when=edits made offline are gone after a reload; no_claim=browser IndexedDB quota
  it('keeps a local copy of unsaved edits and clears it after a save', async () => {
    const { store, control, unsaved } = await setup();
    control.beforeSave = () => {
      throw new SaveError('network');
    };
    edit(store, 'offline edit');
    await vi.advanceTimersByTimeAsync(0);
    const copy = await unsaved.get(store.getState().projectId);
    expect(copy?.data.doc.nodes[0]!.label).toBe('offline edit');
    // "Reload": the server still has version 1, the copy sits on top of it.
    expect(shouldOfferRestore(copy, 1)).toBe(true);
    expect(shouldOfferRestore(copy, 2)).toBe(false);

    control.beforeSave = undefined;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(store.getState().saveStatus).toBe('saved');
    expect(await unsaved.get(store.getState().projectId)).toBeUndefined();
  });

  // protects=offline loss after a partial save; fails_when=an edit made during an in-flight save is not offered for restore once that save lands and the next one fails; no_claim=browser IndexedDB ordering
  it('rebases the local copy on the new version when edits arrived during a save', async () => {
    const { store, control, unsaved } = await setup();
    let release!: () => void;
    control.beforeSave = () => new Promise<void>((r) => (release = r));
    edit(store, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    edit(store, 'b');
    control.beforeSave = () => {
      throw new SaveError('network');
    };
    release();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(store.getState()).toMatchObject({ version: 2, saveStatus: 'error' });
    // "Reload": the server has version 2 (edit a); edit b only lives in the local copy.
    const copy = await unsaved.get(store.getState().projectId);
    expect(copy?.data.doc.nodes[0]!.label).toBe('b');
    expect(shouldOfferRestore(copy, 2)).toBe(true);
  });

  // protects=beforeunload guard; fails_when=closing the tab with unsaved edits gives no warning; no_claim=browser dialog text
  it('guards beforeunload while not saved', async () => {
    const { store, target } = await setup();
    const clean = new Event('beforeunload', { cancelable: true });
    target.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    edit(store, 'a');
    const dirty = new Event('beforeunload', { cancelable: true });
    target.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
