import { describe, expect, it } from 'vitest';
import { createMemoryDraftRepository } from '@/lib/repositories/drafts';
import { createDraftPresence } from '@/lib/repositories/draftPresence';
import { demoProjectFile } from '@/testing/editor';
import { saveStatusOf } from './editorStore';
import { createWorkspace } from './workspace';

describe('workspace across tabs', () => {
  // protects=second tab; fails_when=a tab taking the draft over loses the holder's last edit, or the holder keeps writing the draft afterwards; no_claim=start screen UI (StartPage.test)
  it('writes pending changes and turns read-only when another tab takes over', async () => {
    const drafts = createMemoryDraftRepository();
    const channelName = 'takeover-test';
    const tabA = createWorkspace({ drafts, presence: createDraftPresence({ channelName }) });
    const tabB = createDraftPresence({ channelName });
    const { store } = tabA.getState().open({ data: demoProjectFile() });
    store.getState().applyCommand('edit', (d) => void (d.meta.name = 'Edited in A'));
    expect(saveStatusOf(store.getState())).toBe('unsaved');
    expect(await tabB.holder()).toEqual({ name: 'Edited in A', unsaved: true });

    await tabB.claim();
    expect((await drafts.get())?.project.meta.name).toBe('Edited in A');
    expect(store.getState().readOnly).toBe(true);
    expect(tabA.getState().tabLock).toBe('taken_over');
    expect(await tabB.holder()).toBeNull();
    expect(store.getState().applyCommand('late', (d) => void (d.meta.name = 'x')).ok).toBe(false);
  });
});
