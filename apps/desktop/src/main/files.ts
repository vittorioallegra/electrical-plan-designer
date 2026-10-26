// Project files on disk: native dialogs (injected), atomic writes, the stat check of Save and the
// list of paths the renderer may write. No Electron imports, so it is tested in plain Node.
import { randomBytes } from 'node:crypto';
import * as nodeFs from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import type {
  ExportFilter,
  ExportResult,
  FileStat,
  OpenedFile,
  SaveAsResult,
  SaveResult,
} from '@epd/bridge/bridge';

export type FsOps = Pick<typeof nodeFs, 'open' | 'readFile' | 'rename' | 'stat' | 'unlink'>;

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
}: {
  dialogs: FileDialogs<Owner>;
  fs?: FsOps;
  platform?: NodeJS.Platform;
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

  /** Temp file next to the target, fsync, rename; the temp file is removed on any failure. */
  async function atomicWrite(path: string, bytes: Uint8Array): Promise<FileStat> {
    const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`);
    let handle: Awaited<ReturnType<FsOps['open']>> | undefined;
    try {
      handle = await fs.open(temp, 'wx');
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await fs.rename(temp, path);
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await fs.unlink(temp).catch(() => undefined);
      throw error;
    }
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

  return {
    allow: (path) => void allowed.add(keyOf(path)),
    isAllowed: (path) => allowed.has(keyOf(path)),

    async open(owner) {
      const path = await dialogs.chooseFileToOpen(owner);
      if (path === null) return null;
      const bytes = await fs.readFile(path);
      const stat = await statOf(path);
      allowed.add(keyOf(path));
      return { path, name: basename(path), bytes: new Uint8Array(bytes), stat };
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
      return write(path, bytes);
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
