// The draft of the open project, kept on this device so a closed tab or a crash loses nothing.
import { idbRun } from './idb';
import type { Draft, DraftRepository } from './types';

const KEY = 'current';

export function createIndexedDbDraftRepository(): DraftRepository {
  let persistRequested = false;
  return {
    async get() {
      const draft = await idbRun(
        'drafts',
        'readonly',
        (s) => s.get(KEY) as IDBRequest<Draft | undefined>,
      );
      return draft ?? null;
    },
    async save(draft) {
      if (!persistRequested) {
        persistRequested = true;
        // Asks the browser not to evict the draft under storage pressure.
        void globalThis.navigator?.storage?.persist?.().catch(() => false);
      }
      await idbRun('drafts', 'readwrite', (s) => s.put(draft, KEY));
    },
    async clear() {
      await idbRun('drafts', 'readwrite', (s) => s.delete(KEY));
    },
  };
}

export function createMemoryDraftRepository(): DraftRepository & { draft: Draft | null } {
  const repo = {
    draft: null as Draft | null,
    async get() {
      return repo.draft && structuredClone(repo.draft);
    },
    async save(draft: Draft) {
      repo.draft = structuredClone(draft);
    },
    async clear() {
      repo.draft = null;
    },
  };
  return repo;
}
