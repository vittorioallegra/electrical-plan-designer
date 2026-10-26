// The library (company, catalogs, prices, presets, defaults). The desktop app keeps it as files
// in its app data folder through `window.epd` (main validates and writes them atomically); an
// in-memory fake stands in for jsdom and browsers, where tests seed and read it back.
import type { EpdBridge } from '@epd/bridge/bridge';
import type { ProjectCatalog } from '@epd/domain/catalog/types';
import { defaultLibrary, loadLibrary, type LibraryCore } from '@epd/domain/library';
import type { LibraryData, LibraryRepository } from './types';

export function createDesktopLibraryRepository(library: EpdBridge['library']): LibraryRepository {
  return {
    async load() {
      const snapshot = await library.load();
      const invalid = [...snapshot.invalid];
      let loaded = defaultLibrary();
      try {
        loaded = loadLibrary(snapshot.library);
      } catch {
        invalid.push('library.json');
      }
      return {
        library: loaded,
        logo: snapshot.logo && { ...snapshot.logo, bytes: new Uint8Array(snapshot.logo.bytes) },
        invalid,
      };
    },
    saveCore: (core) => library.saveCore(core),
    saveCatalog: (catalog) => library.saveCatalog(catalog),
    removeCatalog: (id) => library.removeCatalog(id),
    setLogo: (logo) => library.setLogo(logo),
    replace: ({ library: next, logo }) => library.replace({ library: next, logo }),
  };
}

export interface MemoryLibraryRepository extends LibraryRepository {
  /** What is stored; assign to seed it (a store loads it on `reload()` or at start). */
  data: LibraryData;
  /** Files reported as set aside by the next `load()`. */
  invalid: string[];
  /** One entry per write, in order: `core`, `catalog:<id>`, `remove:<id>`, `logo`, `replace`. */
  writes: string[];
  /** When set, every write fails with this message. */
  failWrites: string | null;
  /** Backups the fake took when the library was replaced, newest last. */
  backups: LibraryData[];
}

/** structuredClone hands out bytes of another realm under jsdom; copy the logo by hand. */
const copyData = (data: LibraryData): LibraryData => ({
  library: structuredClone(data.library),
  logo: data.logo && { mimeType: data.logo.mimeType, bytes: data.logo.bytes.slice() },
});

export function createMemoryLibraryRepository(
  seed: Partial<LibraryData> & { invalid?: string[] } = {},
): MemoryLibraryRepository {
  const repo: MemoryLibraryRepository = {
    data: { library: seed.library ?? defaultLibrary(), logo: seed.logo ?? null },
    invalid: seed.invalid ?? [],
    writes: [],
    failWrites: null,
    backups: [],
    async load() {
      return { ...copyData(repo.data), invalid: [...repo.invalid] };
    },
    async saveCore(core: LibraryCore) {
      write('core');
      repo.data.library = { ...structuredClone(core), catalogs: repo.data.library.catalogs };
    },
    async saveCatalog(catalog: ProjectCatalog) {
      write(`catalog:${catalog.id}`);
      const { catalogs } = repo.data.library;
      const next = structuredClone(catalog);
      const at = catalogs.findIndex((c) => c.id === catalog.id);
      repo.data.library = {
        ...repo.data.library,
        catalogs: at < 0 ? [...catalogs, next] : catalogs.map((c, i) => (i === at ? next : c)),
      };
    },
    async removeCatalog(id) {
      write(`remove:${id}`);
      const library = repo.data.library;
      repo.data.library = { ...library, catalogs: library.catalogs.filter((c) => c.id !== id) };
    },
    async setLogo(logo) {
      write('logo');
      repo.data.logo = copyData({ library: repo.data.library, logo }).logo;
    },
    async replace(data) {
      write('replace');
      repo.backups.push(repo.data);
      repo.data = copyData(data);
    },
  };
  function write(name: string) {
    if (repo.failWrites) throw new Error(repo.failWrites);
    repo.writes.push(name);
  }
  return repo;
}
