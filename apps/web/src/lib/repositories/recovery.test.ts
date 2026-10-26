import { describe, expect, it } from 'vitest';
import type { EpdBridge, RecoverySaveArgs } from '@epd/bridge/bridge';
import { demoProjectFile } from '@/testing/editor';
import { createDesktopRecoveryRepository } from './recovery';

/** Main's side of the recovery copy: keeps the asset bytes it was sent, drops those not in `meta`. */
function fakeMain() {
  const held = new Map<string, Uint8Array>();
  const bridge: EpdBridge['recovery'] = {
    async save(args: RecoverySaveArgs) {
      for (const a of args.newAssets) held.set(a.id, a.bytes);
      const keep = new Set(args.meta.assets.map((a) => a.id));
      for (const id of [...held.keys()]) if (!keep.has(id)) held.delete(id);
    },
    async load() {
      return null;
    },
    async clear() {
      held.clear();
    },
  };
  return { held, bridge };
}

const asset = { mimeType: 'image/png' as const, bytes: new Uint8Array([1, 2, 3]) };
const copy = (assets: Map<string, typeof asset>) => ({
  project: demoProjectFile(),
  assets,
  file: null,
  savedToFile: false,
  savedAt: '2026-10-26T10:00:00.000Z',
});

describe('desktop recovery repository', () => {
  // protects=AC 9 a plan image that comes back after an undo is in the recovery copy; fails_when=an asset main dropped (it was unreferenced for one autosave) is not sent again once the project references it, so the restored project lacks the image; no_claim=the IPC and main's folder (main tests, Electron E2E)
  it('sends an asset again when main dropped it and the project uses it again', async () => {
    const main = fakeMain();
    const repo = createDesktopRecoveryRepository(main.bridge);
    await repo.save(copy(new Map([['plan-a', asset]])));
    expect(main.held.has('plan-a')).toBe(true);
    await repo.save(copy(new Map()));
    expect(main.held.has('plan-a')).toBe(false);
    await repo.save(copy(new Map([['plan-a', asset]])));
    expect(main.held.has('plan-a')).toBe(true);
  });
});
