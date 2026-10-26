// The draft of the open project, kept on this device so a closed tab or a crash loses nothing.
import type { Draft, DraftRepository } from './types';

const DB_NAME = 'epd';
const DB_VERSION = 2;
const STORE = 'drafts';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Version 1 kept per-project copies of unsaved edits; the draft replaces them.
      if (db.objectStoreNames.contains('unsaved')) db.deleteObjectStore('unsaved');
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export function createIndexedDbDraftRepository(): DraftRepository {
  let persistRequested = false;
  return {
    async get() {
      const draft = await run('readonly', (s) => s.get(KEY) as IDBRequest<Draft | undefined>);
      return draft ?? null;
    },
    async save(draft) {
      if (!persistRequested) {
        persistRequested = true;
        // Asks the browser not to evict the draft under storage pressure.
        void globalThis.navigator?.storage?.persist?.().catch(() => false);
      }
      await run('readwrite', (s) => s.put(draft, KEY));
    },
    async clear() {
      await run('readwrite', (s) => s.delete(KEY));
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
