// Device-local copy of unsaved edits (IndexedDB), so a network drop + closed tab loses nothing.
import type { EditorData } from './editorStore';

export interface UnsavedCopy {
  projectId: string;
  /** Server version the edits are based on. */
  baseVersion: number;
  data: EditorData;
  savedAt: string;
}

export interface UnsavedStore {
  get(projectId: string): Promise<UnsavedCopy | undefined>;
  put(copy: UnsavedCopy): Promise<void>;
  delete(projectId: string): Promise<void>;
}

const DB_NAME = 'epd';
const STORE = 'unsaved';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'projectId' });
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

export function createIndexedDbUnsavedStore(): UnsavedStore {
  return {
    get: (projectId) =>
      run('readonly', (s) => s.get(projectId) as IDBRequest<UnsavedCopy | undefined>),
    put: (copy) => run('readwrite', (s) => s.put(copy)).then(() => undefined),
    delete: (projectId) => run('readwrite', (s) => s.delete(projectId)).then(() => undefined),
  };
}

export function createMemoryUnsavedStore(): UnsavedStore & { copies: Map<string, UnsavedCopy> } {
  const copies = new Map<string, UnsavedCopy>();
  return {
    copies,
    async get(id) {
      return copies.get(id) && structuredClone(copies.get(id));
    },
    async put(copy) {
      copies.set(copy.projectId, structuredClone(copy));
    },
    async delete(id) {
      copies.delete(id);
    },
  };
}

/** A local copy is offered for restore when it sits on top of the current server version. */
export function shouldOfferRestore(copy: UnsavedCopy | undefined, serverVersion: number): boolean {
  return copy !== undefined && copy.baseVersion >= serverVersion;
}
