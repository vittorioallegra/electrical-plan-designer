import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDraftRepository } from '@/lib/repositories/drafts';
import { demoProjectFile } from '@/testing/editor';
import { createWorkspace } from './workspace';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('workspace', () => {
  // protects=one open project per tab; fails_when=opening a project keeps the previous one's autosave running or the draft ends up as the previous project; no_claim=routes
  it('replaces the open project and its autosave', async () => {
    const drafts = createMemoryDraftRepository();
    const workspace = createWorkspace({ drafts, exposeTestHandle: true });
    const first = workspace.getState().open({ data: demoProjectFile() });
    first.store.getState().applyCommand('a', (d) => void (d.meta.name = 'First'));
    const second = workspace.getState().open({
      data: { ...demoProjectFile(), meta: { ...demoProjectFile().meta, name: 'Second' } },
    });
    expect(workspace.getState().current).toBe(second);
    expect(window.__epd?.store).toBe(second.store);
    await vi.advanceTimersByTimeAsync(2000);
    expect(drafts.draft?.project.meta.name).toBe('Second');
    // The first project's autosave is stopped: its later edits never reach the draft.
    first.store.getState().applyCommand('b', (d) => void (d.meta.name = 'First again'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(drafts.draft?.project.meta.name).toBe('Second');

    workspace.getState().close();
    expect(workspace.getState().current).toBeNull();
    expect(window.__epd?.store).toBeUndefined();
  });
});
