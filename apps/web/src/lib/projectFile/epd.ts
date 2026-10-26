// Reads and writes `.epd` files: a zip of manifest.json, project.json and assets/<id>.<ext>.
// The JSON parts are validated and migrated by @epd/domain/projectFile.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import {
  loadProjectFile,
  ProjectFileError,
  referencedAssetIds,
  serializeProjectFile,
  type ProjectFile,
} from '@epd/domain/projectFile';

export interface ProjectAsset {
  mimeType: AssetMimeType;
  bytes: Uint8Array;
}

/** Asset id → file content. */
export type ProjectAssets = Map<string, ProjectAsset>;

export interface OpenedProject {
  project: ProjectFile;
  assets: ProjectAssets;
}

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
} as const;

export type AssetMimeType = keyof typeof EXTENSIONS;

const MIME_TYPES = new Map<string, AssetMimeType>(
  Object.entries(EXTENSIONS).map(([mime, ext]) => [ext, mime as AssetMimeType]),
);

/** The asset as a Blob, e.g. to decode an image. */
export function assetBlob(asset: ProjectAsset): Blob {
  // fflate and Electron IPC always hand out plain ArrayBuffer-backed arrays.
  return new Blob([asset.bytes as Uint8Array<ArrayBuffer>], { type: asset.mimeType });
}

export function isAssetMimeType(type: string): type is AssetMimeType {
  return type in EXTENSIONS;
}

/** Asset ids become file names, so they are limited to a safe alphabet. */
const ASSET_ID = /^[A-Za-z0-9_-]+$/;
const ASSET_PATH = /^assets\/([A-Za-z0-9_-]+)\.([a-z0-9]+)$/;

function parseJson(files: Record<string, Uint8Array>, name: string): unknown {
  const bytes = files[name];
  if (!bytes) throw new ProjectFileError('not_a_project', [{ path: name, message: 'missing' }]);
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new ProjectFileError('invalid', [{ path: name, message: 'not valid JSON' }]);
  }
}

/** Opens an `.epd` file. Throws ProjectFileError; assets nothing references are dropped. */
export function readEpd(bytes: Uint8Array): OpenedProject {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ProjectFileError('not_a_project', [{ path: '', message: 'not a zip file' }]);
  }
  const project = loadProjectFile(
    parseJson(files, 'manifest.json'),
    parseJson(files, 'project.json'),
  );

  const found = new Map<string, ProjectAsset>();
  for (const [path, content] of Object.entries(files)) {
    const match = ASSET_PATH.exec(path);
    const mimeType = match ? MIME_TYPES.get(match[2]!) : undefined;
    if (match && mimeType) found.set(match[1]!, { mimeType, bytes: content });
  }
  const assets: ProjectAssets = new Map();
  for (const id of referencedAssetIds(project)) {
    const asset = found.get(id);
    if (!asset) {
      throw new ProjectFileError('invalid', [{ path: `assets/${id}`, message: 'missing asset' }]);
    }
    assets.set(id, asset);
  }
  return { project, assets };
}

export interface WriteOptions {
  appVersion: string;
  now: Date;
}

/** Builds an `.epd` file with the assets the project references (throws if one is missing). */
export function writeEpd(
  project: ProjectFile,
  assets: ReadonlyMap<string, ProjectAsset>,
  { appVersion, now }: WriteOptions,
): Uint8Array {
  const serialized = serializeProjectFile(project, appVersion, now);
  const mtime = now;
  const zippable: Zippable = {
    'manifest.json': [strToU8(JSON.stringify(serialized.manifest, null, 2)), { mtime }],
    'project.json': [strToU8(JSON.stringify(serialized.project)), { mtime }],
  };
  for (const id of [...referencedAssetIds(project)].sort()) {
    const asset = assets.get(id);
    if (!asset) throw new Error(`asset ${id} is referenced but missing`);
    if (!ASSET_ID.test(id)) throw new Error(`asset id ${id} is not a valid file name`);
    // PDFs and images are already compressed: store them as they are.
    zippable[`assets/${id}.${EXTENSIONS[asset.mimeType]}`] = [asset.bytes, { level: 0, mtime }];
  }
  return zipSync(zippable, { level: 6 });
}
