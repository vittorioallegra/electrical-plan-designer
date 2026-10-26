// Opening and saving project files. Every browser behaves the same: a file input opens a
// project, Save downloads it (never writing over a file on disk). An in-memory fake stands in
// for tests and E2E.
import { downloadBlob } from '@/lib/download';
import type { FileAccess, PickedFile } from './types';

export function createBrowserFileAccess(): FileAccess {
  return {
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
            .then((buffer) => resolve({ name: file.name, bytes: new Uint8Array(buffer) }))
            .catch(reject);
        });
        input.click();
      });
    },
    download(bytes, name) {
      downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), name);
    },
  };
}

/** In-memory files, for tests and E2E. */
export interface MemoryFileAccess extends FileAccess {
  /** Files the next open() can pick, and the downloaded ones (the last download per name). */
  files: Map<string, Uint8Array>;
  /** Names of the downloads, in order. */
  downloads: string[];
  /** File the next open() returns (null = the user cancels). */
  nextOpen: string | null;
}

export function createMemoryFileAccess(files = new Map<string, Uint8Array>()): MemoryFileAccess {
  const access: MemoryFileAccess = {
    files,
    downloads: [],
    nextOpen: null,
    async open() {
      const name = access.nextOpen;
      access.nextOpen = null;
      const bytes = name === null ? undefined : files.get(name);
      return name !== null && bytes ? { name, bytes: bytes.slice() } : null;
    },
    download(bytes, name) {
      files.set(name, bytes.slice());
      access.downloads.push(name);
    },
  };
  return access;
}
