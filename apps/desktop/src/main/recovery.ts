// The recovery copy of the open project: `project.json`, `meta.json` and `assets/<id>` in a folder
// of the app data. Every file goes through the same atomic write as Save, so a crash in the
// middle of an autosave leaves the previous copy readable. No Electron imports: tested in Node.
import * as nodeFs from 'node:fs/promises';
import { join } from 'node:path';
import type { RecoveryMeta, RecoverySaveArgs, RecoverySnapshot } from '@epd/bridge/bridge';
import { atomicWrite, type FsOps } from './atomicWrite';

export type RecoveryFsOps = FsOps & Pick<typeof nodeFs, 'mkdir' | 'readdir' | 'rm'>;

export interface RecoveryService {
  save(args: RecoverySaveArgs): Promise<void>;
  load(): Promise<RecoverySnapshot | null>;
  clear(): Promise<void>;
}

const encoder = new TextEncoder();

function parseMeta(text: string): RecoveryMeta | null {
  try {
    const meta = JSON.parse(text) as Partial<RecoveryMeta> | null;
    if (
      typeof meta !== 'object' ||
      meta === null ||
      typeof meta.savedToFile !== 'boolean' ||
      typeof meta.savedAt !== 'string' ||
      !Array.isArray(meta.assets)
    )
      return null;
    return meta as RecoveryMeta;
  } catch {
    return null;
  }
}

export function createRecoveryService({
  dir,
  isAllowedPath,
  allowPath,
  fs = nodeFs,
}: {
  /** Folder of the copy, inside the app data. */
  dir: string;
  /** Whether Save may write `path` (main handed it out). */
  isAllowedPath(path: string): boolean;
  allowPath(path: string): void;
  fs?: RecoveryFsOps;
}): RecoveryService {
  const assetsDir = join(dir, 'assets');
  let queue: Promise<unknown> = Promise.resolve();

  /** Operations run one after the other, in the order they were asked. */
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  async function exists(path: string): Promise<boolean> {
    return fs.stat(path).then(
      () => true,
      () => false,
    );
  }

  return {
    save: (args) =>
      serialized(async () => {
        await fs.mkdir(assetsDir, { recursive: true });
        for (const asset of args.newAssets) {
          const path = join(assetsDir, asset.id);
          if (!(await exists(path))) await atomicWrite(path, asset.bytes, fs);
        }
        // A path main never handed out is not stored: Save would refuse it anyway.
        const file = args.meta.file && isAllowedPath(args.meta.file.path) ? args.meta.file : null;
        const meta: RecoveryMeta = { ...args.meta, file };
        // The project goes last: a crash before it leaves the previous, consistent copy.
        await atomicWrite(join(dir, 'meta.json'), encoder.encode(JSON.stringify(meta)), fs);
        await atomicWrite(join(dir, 'project.json'), encoder.encode(args.project), fs);
        const keep = new Set(meta.assets.map((a) => a.id));
        for (const name of await fs.readdir(assetsDir)) {
          if (!keep.has(name)) await fs.rm(join(assetsDir, name), { force: true });
        }
      }),

    load: () =>
      serialized(async () => {
        try {
          const meta = parseMeta(await fs.readFile(join(dir, 'meta.json'), 'utf8'));
          const project = await fs.readFile(join(dir, 'project.json'), 'utf8');
          if (!meta) return null;
          const assets: RecoverySnapshot['assets'] = [];
          for (const { id } of meta.assets) {
            const bytes = await fs.readFile(join(assetsDir, id)).catch(() => null);
            if (bytes) assets.push({ id, bytes: new Uint8Array(bytes) });
          }
          if (meta.file) allowPath(meta.file.path);
          return { project, meta, assets };
        } catch {
          return null;
        }
      }),

    clear: () => serialized(() => fs.rm(dir, { recursive: true, force: true })),
  };
}
