// The app's IndexedDB database: the draft of the open project and the recent file handles.
const DB_NAME = 'epd';
const DB_VERSION = 3;

export type IdbStore = 'drafts' | 'recentFiles';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Version 1 kept per-project copies of unsaved edits; the draft replaces them.
      if (db.objectStoreNames.contains('unsaved')) db.deleteObjectStore('unsaved');
      for (const store of ['drafts', 'recentFiles'] satisfies IdbStore[]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Runs one request in its own transaction and resolves when the transaction completes. */
export function idbRun<T>(
  store: IdbStore,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
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
