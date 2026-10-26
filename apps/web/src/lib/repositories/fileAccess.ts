// Opening and saving project files: the File System Access API on Chrome and Edge (Save
// overwrites the opened file, recent files keep their handles), a file input and downloads
// elsewhere, and an in-memory fake for tests and E2E.
import { downloadBlob } from '@/lib/download';
import { idbRun } from './idb';
import type { FileAccess, FileRef, PickedFile } from './types';

const RECENT_KEY = 'list';
const RECENT_MAX = 8;
const PICKER_TYPES = [
  { description: 'Electrical Plan Designer project', accept: { 'application/zip': ['.epd'] } },
];

// Parts of the File System Access API that lib.dom does not declare yet.
interface PickerWindow {
  showOpenFilePicker(options: object): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options: object): Promise<FileSystemFileHandle>;
}
interface PermissionHandle extends FileSystemFileHandle {
  queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

async function readHandle(handle: FileSystemFileHandle): Promise<PickedFile> {
  const file = await handle.getFile();
  return { file: { name: file.name, handle }, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** Asks for permission when needed (needs a user gesture); true when granted. */
async function permitted(handle: FileSystemFileHandle, mode: 'read' | 'readwrite') {
  const h = handle as PermissionHandle;
  if (typeof h.queryPermission !== 'function') return true;
  if ((await h.queryPermission({ mode })) === 'granted') return true;
  return (await h.requestPermission({ mode })) === 'granted';
}

function blobOf(bytes: Uint8Array): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

function createFileSystemAccess(picker: PickerWindow): FileAccess {
  const readRecent = () =>
    idbRun('recentFiles', 'readonly', (s) => s.get(RECENT_KEY) as IDBRequest<FileRef[] | undefined>)
      .then((list) => list ?? [])
      .catch(() => [] as FileRef[]);

  async function remember(file: FileRef) {
    const handle = file.handle as FileSystemFileHandle;
    const list = await readRecent();
    const others: FileRef[] = [];
    for (const f of list) {
      const same = await (f.handle as FileSystemFileHandle).isSameEntry(handle).catch(() => false);
      if (!same) others.push(f);
    }
    const next = [{ name: file.name, handle }, ...others].slice(0, RECENT_MAX);
    await idbRun('recentFiles', 'readwrite', (s) => s.put(next, RECENT_KEY)).catch(() => undefined);
  }

  const access: FileAccess = {
    canOverwrite: true,
    async open() {
      let handles: FileSystemFileHandle[];
      try {
        handles = await picker.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
      } catch (e) {
        if (isAbort(e)) return null;
        throw e;
      }
      const picked = await readHandle(handles[0]!);
      void remember(picked.file);
      return picked;
    },
    async reopen(file) {
      const handle = file.handle as FileSystemFileHandle | null;
      if (!handle || !(await permitted(handle, 'read').catch(() => false))) return null;
      try {
        const picked = await readHandle(handle);
        void remember(picked.file);
        return picked;
      } catch {
        return null;
      }
    },
    async save(file, bytes) {
      const handle = file.handle as FileSystemFileHandle | null;
      if (!handle) {
        downloadBlob(blobOf(bytes), file.name);
        return file;
      }
      if (!(await permitted(handle, 'readwrite'))) throw new Error('write permission denied');
      // The writable stream replaces the file only on close(): a failure keeps the old file.
      const writable = await handle.createWritable();
      try {
        await writable.write(blobOf(bytes));
        await writable.close();
      } catch (e) {
        await writable.abort().catch(() => undefined);
        throw e;
      }
      void remember(file);
      return file;
    },
    async saveAs(bytes, suggestedName) {
      let handle: FileSystemFileHandle;
      try {
        handle = await picker.showSaveFilePicker({ suggestedName, types: PICKER_TYPES });
      } catch (e) {
        if (isAbort(e)) return null;
        throw e;
      }
      return access.save({ name: handle.name, handle }, bytes);
    },
    recent: readRecent,
  };
  return access;
}

/** Browsers without the File System Access API: a file input to open, downloads to save. */
function createDownloadFileAccess(): FileAccess {
  return {
    canOverwrite: false,
    open() {
      return new Promise<PickedFile | null>((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.epd';
        input.addEventListener('cancel', () => resolve(null));
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          file
            .arrayBuffer()
            .then((buffer) =>
              resolve({ file: { name: file.name, handle: null }, bytes: new Uint8Array(buffer) }),
            )
            .catch(reject);
        });
        input.click();
      });
    },
    async reopen() {
      return null;
    },
    async save(file, bytes) {
      downloadBlob(blobOf(bytes), file.name);
      return file;
    },
    async saveAs(bytes, suggestedName) {
      downloadBlob(blobOf(bytes), suggestedName);
      return { name: suggestedName, handle: null };
    },
    async recent() {
      return [];
    },
  };
}

export function createBrowserFileAccess(): FileAccess {
  const picker = window as unknown as Partial<PickerWindow>;
  return typeof picker.showOpenFilePicker === 'function' &&
    typeof picker.showSaveFilePicker === 'function'
    ? createFileSystemAccess(picker as PickerWindow)
    : createDownloadFileAccess();
}

/** In-memory files, for tests and E2E. The handle is the file name. */
export interface MemoryFileAccess extends FileAccess {
  files: Map<string, Uint8Array>;
  /** File the next open() returns (null = the user cancels). */
  nextOpen: string | null;
  /** Name the next saveAs() picks (null = the user cancels; default: the suggested name). */
  nextSaveAs: string | null | undefined;
  /** Makes the next save fail. */
  failNextSave: boolean;
}

export function createMemoryFileAccess(files = new Map<string, Uint8Array>()): MemoryFileAccess {
  const recent: string[] = [];
  const touch = (name: string): FileRef => {
    const i = recent.indexOf(name);
    if (i >= 0) recent.splice(i, 1);
    recent.unshift(name);
    return { name, handle: name };
  };
  const read = (name: string): PickedFile | null => {
    const bytes = files.get(name);
    return bytes ? { file: touch(name), bytes: bytes.slice() } : null;
  };
  const access: MemoryFileAccess = {
    files,
    nextOpen: null,
    nextSaveAs: undefined,
    failNextSave: false,
    canOverwrite: true,
    async open() {
      const name = access.nextOpen;
      access.nextOpen = null;
      return name === null ? null : read(name);
    },
    async reopen(file) {
      return read(file.name);
    },
    async save(file, bytes) {
      if (access.failNextSave) {
        access.failNextSave = false;
        throw new Error('write failed');
      }
      files.set(file.name, bytes.slice());
      return touch(file.name);
    },
    async saveAs(bytes, suggestedName) {
      const name = access.nextSaveAs === undefined ? suggestedName : access.nextSaveAs;
      access.nextSaveAs = undefined;
      return name === null ? null : access.save({ name, handle: name }, bytes);
    },
    async recent() {
      return recent.map((name) => ({ name, handle: name }));
    },
  };
  return access;
}
