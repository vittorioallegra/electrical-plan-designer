import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as nodeFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RecoverySaveArgs } from '@epd/bridge/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecoveryService, type RecoveryFsOps } from './recovery';

let root: string;
let dir: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'epd-recovery-'));
  dir = join(root, 'recovery');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const bytes = (...values: number[]) => new Uint8Array(values);
const file = { path: join('/tmp', 'house.epd'), name: 'house.epd', stat: { mtimeMs: 5, size: 9 } };

function copy(over: Partial<RecoverySaveArgs> = {}, assets: string[] = []): RecoverySaveArgs {
  return {
    project: '{"name":"a"}',
    meta: {
      file,
      savedToFile: false,
      savedAt: '2026-10-26T10:00:00Z',
      assets: assets.map((id) => ({ id, mimeType: 'image/png' })),
    },
    newAssets: [],
    ...over,
  };
}

function service(allowed: string[] = [file.path], fs?: RecoveryFsOps) {
  const allowedNow = new Set(allowed);
  const handedOut: string[] = [];
  const recovery = createRecoveryService({
    dir,
    isAllowedPath: (path) => allowedNow.has(path),
    allowPath: (path) => void handedOut.push(path),
    ...(fs ? { fs } : {}),
  });
  return { recovery, handedOut };
}

describe('recovery service', () => {
  // protects=AC 9 recovery lifecycle; fails_when=a saved copy does not load back with its project, bound file and assets, or clear leaves it behind; no_claim=the renderer and the start screen
  it('saves, loads and clears the copy', async () => {
    const { recovery, handedOut } = service();
    expect(await recovery.load()).toBeNull();
    await recovery.save(copy({ newAssets: [{ id: 'bg_1', bytes: bytes(1, 2) }] }, ['bg_1']));
    const loaded = (await recovery.load())!;
    expect(loaded.project).toBe('{"name":"a"}');
    expect(loaded.meta).toMatchObject({ file, savedToFile: false });
    expect(loaded.assets).toEqual([{ id: 'bg_1', bytes: bytes(1, 2) }]);
    // The bound path may be written by Save again after a restart.
    expect(handedOut).toEqual([file.path]);
    expect(readdirSync(dir).sort()).toEqual(['assets', 'copy.json']);

    await recovery.clear();
    expect(await recovery.load()).toBeNull();
    expect(readdirSync(root)).toEqual([]);
    await expect(recovery.clear()).resolves.toBeUndefined();
  });

  // protects=assets written once and pruned; fails_when=an asset id is rewritten on every autosave, or an asset the project dropped stays on disk; no_claim=asset content (ids are never reused for other bytes)
  it('writes an asset once per id and prunes the ones no longer referenced', async () => {
    const { recovery } = service();
    await recovery.save(copy({ newAssets: [{ id: 'a', bytes: bytes(1) }] }, ['a']));
    // Same id again with other bytes: the first write stays.
    await recovery.save(
      copy(
        {
          newAssets: [
            { id: 'a', bytes: bytes(9) },
            { id: 'b', bytes: bytes(2) },
          ],
        },
        ['a', 'b'],
      ),
    );
    expect([...readFileSync(join(dir, 'assets', 'a'))]).toEqual([1]);
    expect(readdirSync(join(dir, 'assets')).sort()).toEqual(['a', 'b']);

    await recovery.save(copy({}, ['b']));
    expect(readdirSync(join(dir, 'assets'))).toEqual(['b']);
  });

  // protects=crash safety; fails_when=a failed write in the middle of an autosave corrupts the previous copy or leaves a temp file; no_claim=power loss (the OS rename is atomic)
  it('keeps the previous copy readable when a write fails', async () => {
    const { recovery } = service();
    await recovery.save(copy({ project: '{"v":1}' }));
    let renames = 0;
    const failing: RecoveryFsOps = {
      ...nodeFs,
      // The first rename (copy.json) fails.
      rename: async (from, to) => {
        if (++renames === 1) throw Object.assign(new Error('boom'), { code: 'ENOSPC' });
        return nodeFs.rename(from, to);
      },
    };
    const { recovery: broken } = service([file.path], failing);
    await expect(broken.save(copy({ project: '{"v":2}' }))).rejects.toThrow('boom');
    expect((await recovery.load())!.project).toBe('{"v":1}');
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  // protects=crash consistency; fails_when=a failure after the new assets are written and before the commit pairs the new asset list with the previous project, or prunes an asset the previous copy still uses; no_claim=power loss
  it('loads the previous project with its assets when a save fails before the commit', async () => {
    const { recovery } = service();
    await recovery.save(copy({ newAssets: [{ id: 'old', bytes: bytes(1) }] }, ['old']));
    const failing: RecoveryFsOps = {
      ...nodeFs,
      rename: async (from, to) => {
        if (String(to).endsWith('copy.json'))
          throw Object.assign(new Error('boom'), { code: 'EIO' });
        return nodeFs.rename(from, to);
      },
    };
    const { recovery: broken } = service([file.path], failing);
    // The new copy drops `old` and adds `new`.
    await expect(
      broken.save(
        copy({ project: '{"v":2}', newAssets: [{ id: 'new', bytes: bytes(2) }] }, ['new']),
      ),
    ).rejects.toThrow('boom');
    const loaded = (await recovery.load())!;
    expect(loaded.meta.assets.map((a) => a.id)).toEqual(['old']);
    expect(loaded.assets).toEqual([{ id: 'old', bytes: bytes(1) }]);
  });

  // protects=path allowlist; fails_when=a recovery copy can bind a restored project to a path main never handed out; no_claim=the IPC sender check
  it('does not bind the copy to a path main did not hand out', async () => {
    const { recovery, handedOut } = service([]);
    await recovery.save(copy());
    expect((await recovery.load())!.meta.file).toBeNull();
    expect(handedOut).toEqual([]);
  });

  // protects=damaged copy; fails_when=a half-written or unreadable copy crashes start-up instead of being treated as none; no_claim=repairing it
  it('treats a damaged copy as none and lists only the assets still on disk', async () => {
    const { recovery } = service();
    await recovery.save(
      copy(
        {
          newAssets: [
            { id: 'a', bytes: bytes(1) },
            { id: 'b', bytes: bytes(2) },
          ],
        },
        ['a', 'b'],
      ),
    );
    rmSync(join(dir, 'assets', 'a'));
    expect((await recovery.load())!.assets.map((a) => a.id)).toEqual(['b']);
    writeFileSync(join(dir, 'copy.json'), '{ not json');
    expect(await recovery.load()).toBeNull();
  });

  // protects=ordering; fails_when=a clear asked after a save runs before it, so the old copy comes back; no_claim=timing
  it('runs operations in the order they were asked', async () => {
    const { recovery } = service();
    void recovery.save(copy());
    void recovery.clear();
    await recovery.save(copy({ project: '{"last":true}' }));
    expect((await recovery.load())!.project).toBe('{"last":true}');
  });
});
