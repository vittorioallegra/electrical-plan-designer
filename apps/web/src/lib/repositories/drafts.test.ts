import { describe, expect, it } from 'vitest';
import { newProjectFile } from '@epd/domain/projectFile';
import { createIndexedDbDraftRepository } from './drafts';
import type { Draft } from './types';

function draft(name: string): Draft {
  return {
    project: newProjectFile({ name, firstFloorName: 'Ground floor' }, new Date('2026-10-26')),
    assets: new Map([['plan_1', { mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }]]),
    savedToFile: false,
    savedAt: '2026-10-26T10:00:00.000Z',
    recordId: 'p1',
  };
}

describe('IndexedDB draft repository', () => {
  // protects=draft persistence; fails_when=a saved draft (assets included) does not come back intact or clear() leaves it; no_claim=real browser quotas and eviction
  it('keeps one draft with its assets, replaced on save and removed on clear', async () => {
    const repo = createIndexedDbDraftRepository();
    expect(await repo.get()).toBeNull();
    await repo.save(draft('First'));
    await repo.save(draft('Second'));
    const read = createIndexedDbDraftRepository();
    const stored = await read.get();
    expect(stored?.project.meta.name).toBe('Second');
    // Compared by value: fake-indexeddb clones into another realm's Uint8Array.
    expect([...stored!.assets.get('plan_1')!.bytes]).toEqual([1, 2, 3]);
    expect(stored).toMatchObject({ savedToFile: false, recordId: 'p1' });
    await read.clear();
    expect(await repo.get()).toBeNull();
  });
});
