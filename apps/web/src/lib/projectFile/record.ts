// Bridges a server project record to the open-project model (a ProjectFile plus its assets),
// while projects are still listed and created on the server.
import { newId, type IdGenerator } from '@epd/domain/ids';
import { defaultCompany, type ProjectFile } from '@epd/domain/projectFile';
import type { ProjectDoc } from '@epd/domain/types';
import type { FileRepository, ProjectRecord } from '@/lib/repositories/types';
import { isAssetMimeType, type OpenedProject, type ProjectAssets } from './epd';

/**
 * Builds the open project from a record whose doc already passed `loadDoc`. Floor backgrounds
 * are downloaded and get fresh asset ids (storage paths are not valid file names).
 * Company data, catalogs, price overrides and box presets still live in the profile.
 */
export async function openRecord(
  record: ProjectRecord,
  doc: ProjectDoc,
  files: Pick<FileRepository, 'download'>,
  genId: IdGenerator = newId,
): Promise<OpenedProject> {
  const assets: ProjectAssets = new Map();
  const floors = await Promise.all(
    doc.floors.map(async (floor) => {
      if (!floor.background) return floor;
      const path = floor.background.assetId;
      const blob = await files.download('backgrounds', path);
      const type = blob.type || (path.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
      if (!isAssetMimeType(type)) throw new Error(`unsupported background type ${type}`);
      const assetId = genId();
      assets.set(assetId, { mimeType: type, bytes: new Uint8Array(await blob.arrayBuffer()) });
      return { ...floor, background: { ...floor.background, assetId } };
    }),
  );
  const project: ProjectFile = {
    meta: {
      name: record.meta.name,
      clientName: record.meta.clientName,
      address: record.meta.address,
      // Records do not keep their creation date.
      createdAt: record.meta.updatedAt,
    },
    company: defaultCompany(),
    settings: record.settings,
    quote: record.quote,
    catalogs: [],
    priceOverrides: {},
    boxPresets: [],
    doc: { ...doc, floors },
  };
  return { project, assets };
}
