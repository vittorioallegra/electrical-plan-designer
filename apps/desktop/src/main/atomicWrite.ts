// The atomic write shared by project files and the recovery copy: a crash or a failure at any
// point leaves the previous file untouched and no temp file behind. No Electron imports.
import { randomBytes } from 'node:crypto';
import * as nodeFs from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export type FsOps = Pick<typeof nodeFs, 'open' | 'readFile' | 'rename' | 'stat' | 'unlink'>;

/** Temp file next to the target, fsync, rename; the temp file is removed on any failure. */
export async function atomicWrite(
  path: string,
  bytes: Uint8Array,
  fs: FsOps = nodeFs,
): Promise<void> {
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
}
