// The recent project files: the last 10 paths opened or saved, newest first, kept in `recent.json`
// in the app data (written atomically). A path whose file is gone stays in the list, flagged as
// missing, until the user removes it. No Electron imports: tested in plain Node.
import * as nodeFs from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { RecentFile } from '@epd/bridge/bridge';
import { atomicWrite, type FsOps } from './atomicWrite';

export const MAX_RECENT = 10;

export interface RecentService {
  /** The list with each file's presence on disk. */
  list(): Promise<RecentFile[]>;
  /** Moves `path` to the top (adds it when new), dropping the oldest beyond 10. */
  add(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Whether `path` is in the list (what the renderer may ask main to open). */
  has(path: string): Promise<boolean>;
  /** Called after every change of the list (e.g. to rebuild the menu). */
  onChange(listener: () => void): void;
}

export function createRecentService({
  file,
  fs = nodeFs,
  platform = process.platform,
}: {
  file: string;
  fs?: FsOps;
  platform?: NodeJS.Platform;
}): RecentService {
  const listeners: (() => void)[] = [];
  // Windows paths ignore case.
  const keyOf = (path: string) =>
    platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  let loaded: Promise<string[]> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs `task` after every earlier one: changes never interleave. */
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  async function read(): Promise<string[]> {
    try {
      const json = JSON.parse(new TextDecoder().decode(await fs.readFile(file))) as {
        paths?: unknown;
      } | null;
      const paths = Array.isArray(json?.paths) ? json.paths : [];
      return paths.filter((p): p is string => typeof p === 'string').slice(0, MAX_RECENT);
    } catch {
      // No file yet, or one that cannot be read: start empty (the next change rewrites it).
      return [];
    }
  }

  const paths = () => (loaded ??= read());

  async function change(update: (current: string[]) => string[]): Promise<void> {
    const changed = await serialized(async () => {
      const current = await paths();
      const next = update(current);
      if (next.length === current.length && next.every((p, i) => p === current[i])) return false;
      loaded = Promise.resolve(next);
      try {
        await atomicWrite(
          file,
          new TextEncoder().encode(JSON.stringify({ version: 1, paths: next })),
          fs,
        );
      } catch (error) {
        // The list stays right in memory; a failed write only loses it at the next start.
        console.error('recent files not saved', error);
      }
      return true;
    });
    if (changed) listeners.forEach((listener) => listener());
  }

  return {
    async list() {
      const current = await serialized(paths);
      return Promise.all(
        current.map(async (path) => ({
          path,
          name: basename(path),
          missing: await fs.stat(path).then(
            (s) => !s.isFile(),
            () => true,
          ),
        })),
      );
    },
    add: (path) =>
      change((current) =>
        [path, ...current.filter((p) => keyOf(p) !== keyOf(path))].slice(0, MAX_RECENT),
      ),
    remove: (path) => change((current) => current.filter((p) => keyOf(p) !== keyOf(path))),
    async has(path) {
      const current = await serialized(paths);
      return current.some((p) => keyOf(p) === keyOf(path));
    },
    onChange: (listener) => void listeners.push(listener),
  };
}
