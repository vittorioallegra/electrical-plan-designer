// Project files on disk: native dialogs (injected), atomic writes, the stat check of Save and the
// list of paths the renderer may write. No Electron imports, so it is tested in plain Node.
import * as nodeFs from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import type {
  ExportFilter,
  ExportResult,
  FileStat,
  OpenedFile,
  SaveAsResult,
  SaveResult,
} from '@epd/bridge/bridge';
import { atomicWrite as atomicWriteFile, type FsOps } from './atomicWrite';

export type { FsOps };

/** The native dialogs. `Owner` is whatever the dialogs need to attach to (a window). */
export interface FileDialogs<Owner> {
  chooseFileToOpen(owner: Owner): Promise<string | null>;
  chooseFileToSave(
    owner: Owner,
    options: { defaultName: string; filters: ExportFilter[] },
  ): Promise<string | null>;
}

export const PROJECT_FILTER: ExportFilter = {
  name: 'Electrical Plan Designer',
  extensions: ['epd'],
};

export interface FileService<Owner> {
  open(owner: Owner): Promise<OpenedFile | null>;
  /** Opens a path from the recent list or the OS; null when the file is gone. */
  openPath(path: string): Promise<OpenedFile | null>;
  save(path: string, bytes: Uint8Array, expected: FileStat | null): Promise<SaveResult>;
  saveAs(owner: Owner, suggestedName: string, bytes: Uint8Array): Promise<SaveAsResult>;
  exportFile(
    owner: Owner,
    name: string,
    bytes: Uint8Array,
    filters: ExportFilter[],
  ): Promise<ExportResult>;
  /** Lets `save` write to `path`: it came from a dialog, the recent list or the OS. */
  allow(path: string): void;
  isAllowed(path: string): boolean;
}

export function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : 'UNKNOWN';
}

function withExtension(path: string, extension: string): string {
  return extname(path) === '' ? `${path}.${extension}` : path;
}

export function createFileService<Owner>({
  dialogs,
  fs = nodeFs,
  platform = process.platform,
  canOpen = async () => false,
  onUsed = () => undefined,
}: {
  dialogs: FileDialogs<Owner>;
  fs?: FsOps;
  platform?: NodeJS.Platform;
  /** Whether `openPath` may read a path nobody handed out yet (the recent list). */
  canOpen?(path: string): Promise<boolean>;
  /** A project file was opened or saved: it goes to the top of the recent list. */
  onUsed?(path: string): void;
}): FileService<Owner> {
  const allowed = new Set<string>();
  const queues = new Map<string, Promise<unknown>>();
  // Windows paths ignore case.
  const keyOf = (path: string) =>
    platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);

  /** Runs `task` after every earlier task on the same path: writes never interleave. */
  function serialized<T>(path: string, task: () => Promise<T>): Promise<T> {
    const key = keyOf(path);
    const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
    const tail = run.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
    return run;
  }

  async function statOf(path: string): Promise<FileStat> {
    const s = await fs.stat(path);
    return { mtimeMs: s.mtimeMs, size: s.size };
  }

  async function atomicWrite(path: string, bytes: Uint8Array): Promise<FileStat> {
    await atomicWriteFile(path, bytes, fs);
    return statOf(path);
  }

  async function write(path: string, bytes: Uint8Array): Promise<SaveAsResult> {
    try {
      const stat = await serialized(path, () => atomicWrite(path, bytes));
      return { status: 'saved', path, name: basename(path), stat };
    } catch (error) {
      return { status: 'failed', code: errorCode(error) };
    }
  }

  async function read(path: string): Promise<OpenedFile> {
    const bytes = await fs.readFile(path);
    const stat = await statOf(path);
    allowed.add(keyOf(path));
    onUsed(path);
    return { path, name: basename(path), bytes: new Uint8Array(bytes), stat };
  }

  return {
    allow: (path) => void allowed.add(keyOf(path)),
    isAllowed: (path) => allowed.has(keyOf(path)),

    async open(owner) {
      const path = await dialogs.chooseFileToOpen(owner);
      return path === null ? null : read(path);
    },

    async openPath(path) {
      if (!allowed.has(keyOf(path)) && !(await canOpen(path))) throw new Error('path not allowed');
      try {
        return await read(path);
      } catch (error) {
        if (errorCode(error) === 'ENOENT') return null;
        throw error;
      }
    },

    async save(path, bytes, expected) {
      if (!allowed.has(keyOf(path))) return { status: 'failed', code: 'EPERM' };
      return serialized(path, async (): Promise<SaveResult> => {
        try {
          if (expected) {
            // A file that is gone is recreated; one that differs is the user's call.
            const current = await statOf(path).catch((error: unknown) => {
              if (errorCode(error) === 'ENOENT') return null;
              throw error;
            });
            if (current && (current.mtimeMs !== expected.mtimeMs || current.size !== expected.size))
              return { status: 'changed_on_disk' };
          }
          const stat = await atomicWrite(path, bytes);
          onUsed(path);
          return { status: 'saved', path, name: basename(path), stat };
        } catch (error) {
          return { status: 'failed', code: errorCode(error) };
        }
      });
    },

    async saveAs(owner, suggestedName, bytes) {
      const chosen = await dialogs.chooseFileToSave(owner, {
        defaultName: suggestedName,
        filters: [PROJECT_FILTER],
      });
      if (chosen === null) return { status: 'cancelled' };
      const path = withExtension(chosen, 'epd');
      allowed.add(keyOf(path));
      const result = await write(path, bytes);
      if (result.status === 'saved') onUsed(path);
      return result;
    },

    async exportFile(owner, name, bytes, filters) {
      const chosen = await dialogs.chooseFileToSave(owner, { defaultName: name, filters });
      if (chosen === null) return { status: 'cancelled' };
      // Not allowed for `save`: an export is not the project's file.
      const result = await write(chosen, bytes);
      return result.status === 'saved'
        ? { status: 'saved', path: result.path }
        : result.status === 'failed'
          ? result
          : { status: 'cancelled' };
    },
  };
}
