// The recovery copy of the open project. The desktop app keeps it in its app data folder through
// `window.epd` (main writes it atomically); an in-memory fake stands in for jsdom and browsers.
import type { EpdBridge } from '@epd/bridge/bridge';
import { projectFileSchema } from '@epd/domain/projectFile';
import { isAssetMimeType, type ProjectAssets } from '@/lib/projectFile/epd';
import type { RecoveryCopy, RecoveryRepository } from './types';

export function createDesktopRecoveryRepository(
  recovery: EpdBridge['recovery'],
): RecoveryRepository {
  // Asset ids main holds: each id's bytes cross the IPC once. Main drops the ones a save no
  // longer lists, so after a save this is exactly that list. Forgotten on clear.
  const written = new Set<string>();
  return {
    async get() {
      const snapshot = await recovery.load();
      if (!snapshot) return null;
      let json: unknown;
      try {
        json = JSON.parse(snapshot.project);
      } catch {
        return null;
      }
      const parsed = projectFileSchema.safeParse(json);
      if (!parsed.success) return null;
      const assets: ProjectAssets = new Map();
      for (const { id, bytes } of snapshot.assets) {
        const mimeType = snapshot.meta.assets.find((a) => a.id === id)?.mimeType;
        if (mimeType && isAssetMimeType(mimeType))
          assets.set(id, { mimeType, bytes: new Uint8Array(bytes) });
        written.add(id);
      }
      return {
        project: parsed.data,
        assets,
        file: snapshot.meta.file,
        savedToFile: snapshot.meta.savedToFile,
        savedAt: snapshot.meta.savedAt,
      };
    },
    async save(copy) {
      const newAssets = [...copy.assets]
        .filter(([id]) => !written.has(id))
        .map(([id, asset]) => ({ id, bytes: asset.bytes }));
      await recovery.save({
        project: JSON.stringify(copy.project),
        meta: {
          file: copy.file,
          savedToFile: copy.savedToFile,
          savedAt: copy.savedAt,
          assets: [...copy.assets].map(([id, asset]) => ({ id, mimeType: asset.mimeType })),
        },
        newAssets,
      });
      written.clear();
      for (const id of copy.assets.keys()) written.add(id);
    },
    async clear() {
      await recovery.clear();
      written.clear();
    },
  };
}

export function createMemoryRecoveryRepository(): RecoveryRepository & {
  copy: RecoveryCopy | null;
} {
  const repo = {
    copy: null as RecoveryCopy | null,
    async get() {
      return repo.copy && structuredClone(repo.copy);
    },
    async save(copy: RecoveryCopy) {
      repo.copy = structuredClone(copy);
    },
    async clear() {
      repo.copy = null;
    },
  };
  return repo;
}
