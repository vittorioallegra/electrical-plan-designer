// Project files by path. The desktop app talks to main over `window.epd` (native dialogs,
// atomic writes); an in-memory fake stands in for jsdom tests and browser E2E.
import type { EpdBridge } from '@epd/bridge/bridge';
import type {
  ExportFilter,
  ExportResult,
  FileAccess,
  FileStat,
  OpenedFile,
  RecentFile,
  RecentRepository,
} from './types';

export function createDesktopFileAccess(files: EpdBridge['files']): FileAccess {
  return {
    async open() {
      const opened = await files.open();
      return opened && { ...opened, bytes: new Uint8Array(opened.bytes) };
    },
    async openPath(path) {
      const opened = await files.openPath(path);
      return opened && { ...opened, bytes: new Uint8Array(opened.bytes) };
    },
    save: (path, bytes, expected) => files.save(path, bytes, expected),
    saveAs: (suggestedName, bytes) => files.saveAs(suggestedName, bytes),
    async exportFile(name, blob, filters) {
      return files.exportFile(name, new Uint8Array(await blob.arrayBuffer()), filters);
    },
  };
}

export function createDesktopRecentRepository(recent: EpdBridge['recent']): RecentRepository {
  return { list: () => recent.list(), remove: (path) => recent.remove(path) };
}

/** In-memory files, for tests and E2E. A file's path is its name. */
export interface MemoryFileAccess extends FileAccess {
  /** Files by path: what open() can pick and what was saved or exported. */
  files: Map<string, Uint8Array>;
  /** Paths written by save and Save As, in order. */
  writes: string[];
  /** Names exported, in order (their bytes are in `files`). */
  exports: string[];
  /** File the next open() returns (null = the user cancels). */
  nextOpen: string | null;
  /** Name the next Save As / export dialog returns: undefined = the suggested one, null = cancel. */
  nextSaveAs: string | null | undefined;
  /** OS error code the next writes fail with (null = they succeed). */
  failWrites: string | null;
  /** The recent list: paths opened or saved here, newest first. */
  recent: RecentRepository;
  /** Another program changed a file: new bytes and a new stat. */
  touch(path: string, bytes: Uint8Array): void;
}

export function createMemoryFileAccess(files = new Map<string, Uint8Array>()): MemoryFileAccess {
  let clock = 0;
  const stats = new Map<string, FileStat>();
  const statOf = (path: string): FileStat | undefined => stats.get(path);
  const put = (path: string, bytes: Uint8Array): FileStat => {
    files.set(path, bytes.slice());
    const stat = { mtimeMs: ++clock, size: bytes.length };
    stats.set(path, stat);
    return stat;
  };
  const chosenName = (suggested: string): string | null => {
    const name = access.nextSaveAs === undefined ? suggested : access.nextSaveAs;
    access.nextSaveAs = undefined;
    return name;
  };

  const used: string[] = [];
  const remember = (path: string) => {
    used.splice(0, used.length, path, ...used.filter((p) => p !== path));
    used.length = Math.min(used.length, 10);
  };
  const recent: RecentRepository = {
    async list(): Promise<RecentFile[]> {
      return used.map((path) => ({ path, name: path, missing: !files.has(path) }));
    },
    async remove(path) {
      const at = used.indexOf(path);
      if (at >= 0) used.splice(at, 1);
    },
  };

  const access: MemoryFileAccess = {
    files,
    recent,
    writes: [],
    exports: [],
    nextOpen: null,
    nextSaveAs: undefined,
    failWrites: null,
    touch: (path, bytes) => void put(path, bytes),
    async open() {
      const name = access.nextOpen;
      access.nextOpen = null;
      const bytes = name === null ? undefined : files.get(name);
      if (name === null || !bytes) return null;
      let stat = statOf(name);
      if (!stat || stat.size !== bytes.length) stat = put(name, bytes);
      remember(name);
      const opened: OpenedFile = { path: name, name, bytes: bytes.slice(), stat };
      return opened;
    },
    async openPath(path) {
      const bytes = files.get(path);
      if (!bytes) return null;
      let stat = statOf(path);
      if (!stat || stat.size !== bytes.length) stat = put(path, bytes);
      remember(path);
      return { path, name: path, bytes: bytes.slice(), stat };
    },
    async save(path, bytes, expected) {
      if (access.failWrites) return { status: 'failed', code: access.failWrites };
      const current = statOf(path);
      if (
        expected &&
        current &&
        (current.mtimeMs !== expected.mtimeMs || current.size !== expected.size)
      )
        return { status: 'changed_on_disk' };
      const stat = put(path, bytes);
      access.writes.push(path);
      remember(path);
      return { status: 'saved', path, name: path, stat };
    },
    async saveAs(suggestedName, bytes) {
      const name = chosenName(suggestedName);
      if (name === null) return { status: 'cancelled' };
      if (access.failWrites) return { status: 'failed', code: access.failWrites };
      const stat = put(name, bytes);
      access.writes.push(name);
      remember(name);
      return { status: 'saved', path: name, name, stat };
    },
    async exportFile(name, blob, _filters: ExportFilter[]): Promise<ExportResult> {
      const chosen = chosenName(name);
      if (chosen === null) return { status: 'cancelled' };
      if (access.failWrites) return { status: 'failed', code: access.failWrites };
      put(chosen, new Uint8Array(await blob.arrayBuffer()));
      access.exports.push(chosen);
      return { status: 'saved', path: chosen };
    },
  };
  return access;
}
