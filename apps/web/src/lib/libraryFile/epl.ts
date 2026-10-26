// Reads and writes `.epl` files: the whole library as one zip of `library.json` (everything but
// the catalogs), `catalogs/<id>.json` and `logo.<ext>`, the same layout as the library folder.
// A file is validated whole before anything is replaced.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import {
  isCatalogFileId,
  LibraryError,
  libraryCoreOf,
  loadLibrary,
  logoExtension,
  matchesLogoType,
  MAX_LOGO_BYTES,
  type LogoMimeType,
} from '@epd/domain/library';
import type { LibraryData } from '@/lib/repositories/types';

const LOGO_FILES: Record<string, LogoMimeType> = {
  'logo.png': 'image/png',
  'logo.jpg': 'image/jpeg',
};

function parseJson(bytes: Uint8Array, name: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new LibraryError('invalid', [{ path: name, message: 'not valid JSON' }]);
  }
}

/** Opens an `.epl` file. Throws LibraryError; never returns a partly valid library. */
export function readEpl(bytes: Uint8Array): LibraryData {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new LibraryError('not_a_library', [{ path: '', message: 'not a zip file' }]);
  }
  const core = files['library.json'];
  if (!core)
    throw new LibraryError('not_a_library', [{ path: 'library.json', message: 'missing' }]);

  const catalogs: unknown[] = [];
  for (const [path, content] of Object.entries(files)) {
    const match = /^catalogs\/([^/]+)\.json$/.exec(path);
    if (!match) continue;
    const catalog = parseJson(content, path);
    const id = (catalog as { id?: unknown } | null)?.id;
    if (typeof id !== 'string' || id !== match[1] || !isCatalogFileId(id))
      throw new LibraryError('invalid', [{ path, message: 'catalog id differs from its file' }]);
    catalogs.push(catalog);
  }
  const library = loadLibrary({ ...(parseJson(core, 'library.json') as object), catalogs });
  library.catalogs.sort(
    (a, b) => a.importedAt.localeCompare(b.importedAt) || a.id.localeCompare(b.id),
  );

  let logo: LibraryData['logo'] = null;
  for (const [name, mimeType] of Object.entries(LOGO_FILES)) {
    const logoBytes = files[name];
    if (!logoBytes) continue;
    if (logoBytes.byteLength > MAX_LOGO_BYTES || !matchesLogoType(mimeType, logoBytes))
      throw new LibraryError('invalid', [{ path: name, message: 'not a valid logo' }]);
    logo ??= { mimeType, bytes: logoBytes };
  }
  return { library, logo };
}

/** Builds an `.epl` file from the whole library. */
export function writeEpl({ library, logo }: LibraryData, now: Date): Uint8Array {
  const zippable: Zippable = {
    'library.json': [strToU8(JSON.stringify(libraryCoreOf(library), null, 2)), { mtime: now }],
  };
  for (const catalog of library.catalogs) {
    if (!isCatalogFileId(catalog.id))
      throw new Error(`catalog id ${catalog.id} is not a valid file name`);
    zippable[`catalogs/${catalog.id}.json`] = [
      strToU8(JSON.stringify(catalog, null, 2)),
      { mtime: now },
    ];
  }
  // A logo is an image, already compressed: stored as it is.
  if (logo)
    zippable[`logo.${logoExtension(logo.mimeType)}`] = [logo.bytes, { level: 0, mtime: now }];
  return zipSync(zippable, { level: 6 });
}
