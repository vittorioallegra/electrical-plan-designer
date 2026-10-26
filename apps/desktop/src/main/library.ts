// The library as files in a folder of the app data: `library.json` (everything but the catalogs),
// `catalogs/<id>.json` (one per catalog) and `logo.<ext>`. Every file goes through the same atomic
// write as Save, so one change rewrites one small file and a crash leaves the previous one.
// A file that fails validation is renamed `<name>.invalid-<time>`, never overwritten. No Electron
// imports: tested in Node.
import * as nodeFs from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { LibraryLogo, LibraryReplacement, LibrarySnapshot } from '@epd/bridge/bridge';
import type { ProjectCatalog } from '@epd/domain/catalog/types';
import {
  defaultLibraryCore,
  isLogoMimeType,
  libraryCoreOf,
  loadLibrary,
  loadLibraryCatalog,
  loadLibraryCore,
  logoExtension,
  matchesLogoType,
  MAX_LOGO_BYTES,
  type Library,
  type LibraryCore,
  type LogoMimeType,
} from '@epd/domain/library';
import { atomicWrite, type FsOps } from './atomicWrite';

export type LibraryFsOps = FsOps & Pick<typeof nodeFs, 'cp' | 'mkdir' | 'readdir' | 'rm'>;

export interface LibraryService {
  load(): Promise<LibrarySnapshot & { library: Library }>;
  saveCore(core: unknown): Promise<void>;
  saveCatalog(catalog: unknown): Promise<void>;
  removeCatalog(id: string): Promise<void>;
  setLogo(logo: LibraryLogo | null): Promise<void>;
  replace(replacement: LibraryReplacement): Promise<void>;
}

/** Catalog ids become file names: letters, digits, `_` and `-` only. */
const CATALOG_ID = /^[A-Za-z0-9_-]{1,128}$/;
const LOGO_EXTENSIONS = ['png', 'jpg'] as const;
const logoMimeTypes: Record<(typeof LOGO_EXTENSIONS)[number], LogoMimeType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
};

export class InvalidLibraryArgument extends Error {
  override name = 'InvalidLibraryArgument';
}

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2));

/** `2026-10-26T10-00-00-000Z`: sorts by time and is safe in a file name. */
const stamp = (date: Date) => date.toISOString().replace(/[:.]/g, '-');

function checkedId(id: unknown): string {
  if (typeof id !== 'string' || !CATALOG_ID.test(id))
    throw new InvalidLibraryArgument('invalid catalog id');
  return id;
}

function checkedLogo(logo: unknown): LibraryLogo | null {
  if (logo === null || logo === undefined) return null;
  const value = logo as Partial<LibraryLogo>;
  if (
    !isLogoMimeType(value.mimeType) ||
    !(value.bytes instanceof Uint8Array) ||
    value.bytes.byteLength === 0 ||
    value.bytes.byteLength > MAX_LOGO_BYTES ||
    !matchesLogoType(value.mimeType, value.bytes)
  )
    throw new InvalidLibraryArgument('invalid logo');
  return { mimeType: value.mimeType, bytes: value.bytes };
}

export function createLibraryService({
  dir,
  fs = nodeFs,
  now = () => new Date(),
}: {
  /** Folder of the library, inside the app data. */
  dir: string;
  fs?: LibraryFsOps;
  now?: () => Date;
}): LibraryService {
  const catalogsDir = join(dir, 'catalogs');
  let queue: Promise<unknown> = Promise.resolve();

  /** Operations run one after the other, in the order they were asked. */
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  /** The file's text, or null when it does not exist. */
  async function readText(path: string): Promise<string | null> {
    try {
      return await fs.readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /** Renames an invalid file out of the way; returns the name it has now. */
  async function setAside(path: string): Promise<string> {
    const aside = `${path}.invalid-${stamp(now())}`;
    await fs.rename(path, aside);
    return basename(aside);
  }

  async function loadParsed<T>(
    path: string,
    parse: (json: unknown) => T,
    invalid: string[],
  ): Promise<T | null> {
    const text = await readText(path);
    if (text === null) return null;
    try {
      return parse(JSON.parse(text));
    } catch {
      invalid.push(await setAside(path));
      return null;
    }
  }

  async function loadLogo(invalid: string[]): Promise<LibraryLogo | null> {
    for (const ext of LOGO_EXTENSIONS) {
      const path = join(dir, `logo.${ext}`);
      const bytes = await fs.readFile(path).then(
        (b) => new Uint8Array(b),
        () => null,
      );
      if (!bytes) continue;
      const mimeType = logoMimeTypes[ext];
      if (bytes.byteLength <= MAX_LOGO_BYTES && matchesLogoType(mimeType, bytes))
        return { mimeType, bytes };
      invalid.push(await setAside(path));
    }
    return null;
  }

  async function writeCatalog(catalog: ProjectCatalog): Promise<void> {
    await fs.mkdir(catalogsDir, { recursive: true });
    await atomicWrite(join(catalogsDir, `${checkedId(catalog.id)}.json`), encode(catalog), fs);
  }

  async function writeLogo(logo: LibraryLogo | null): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    const keep = logo ? logoExtension(logo.mimeType) : null;
    if (logo) await atomicWrite(join(dir, `logo.${keep}`), logo.bytes, fs);
    for (const ext of LOGO_EXTENSIONS) {
      if (ext !== keep) await fs.rm(join(dir, `logo.${ext}`), { force: true });
    }
  }

  async function writeCore(core: LibraryCore): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    await atomicWrite(join(dir, 'library.json'), encode(core), fs);
  }

  return {
    load: () =>
      serialized(async () => {
        const invalid: string[] = [];
        const core =
          (await loadParsed(join(dir, 'library.json'), loadLibraryCore, invalid)) ??
          defaultLibraryCore();
        const catalogs: ProjectCatalog[] = [];
        const names = await fs.readdir(catalogsDir).catch(() => [] as string[]);
        for (const name of names.sort()) {
          if (!name.endsWith('.json')) continue;
          const catalog = await loadParsed(
            join(catalogsDir, name),
            (json) => {
              const parsed = loadLibraryCatalog(json);
              // The file name is the id: a mismatch is a file someone moved or edited.
              if (`${parsed.id}.json` !== name) throw new Error('catalog id differs from file');
              return parsed;
            },
            invalid,
          );
          if (catalog) catalogs.push(catalog);
        }
        catalogs.sort(
          (a, b) => a.importedAt.localeCompare(b.importedAt) || a.id.localeCompare(b.id),
        );
        const library: Library = { ...core, catalogs };
        return { library, logo: await loadLogo(invalid), invalid };
      }),

    saveCore: (core) => serialized(async () => writeCore(loadLibraryCore(core))),

    saveCatalog: (catalog) =>
      serialized(async () => {
        const valid = loadLibraryCatalog(catalog);
        checkedId(valid.id);
        await writeCatalog(valid);
      }),

    removeCatalog: (id) =>
      serialized(() => fs.rm(join(catalogsDir, `${checkedId(id)}.json`), { force: true })),

    setLogo: (logo) => serialized(() => writeLogo(checkedLogo(logo))),

    replace: (replacement) =>
      serialized(async () => {
        const library = loadLibrary(replacement.library);
        library.catalogs.forEach((c) => checkedId(c.id));
        const logo = checkedLogo(replacement.logo);
        // The old library stays readable next to the new one; this folder is never touched again.
        const exists = await fs.stat(dir).then(
          () => true,
          () => false,
        );
        if (exists)
          await fs.cp(dir, join(dirname(dir), `${basename(dir)}.backup-${stamp(now())}`), {
            recursive: true,
          });
        for (const catalog of library.catalogs) await writeCatalog(catalog);
        await writeLogo(logo);
        await writeCore(libraryCoreOf(library));
        // Catalogs of the old library that are not in the new one.
        const keep = new Set(library.catalogs.map((c) => `${c.id}.json`));
        for (const name of await fs.readdir(catalogsDir)) {
          if (name.endsWith('.json') && !keep.has(name))
            await fs.rm(join(catalogsDir, name), { force: true });
        }
      }),
  };
}
