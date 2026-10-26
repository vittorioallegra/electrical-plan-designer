// The library store: company, catalogs, prices, presets and defaults of the app, outside any
// project and outside undo. Every change is written through to the library files, one file per
// changed part; the store is loaded before the first route renders.
import { produce, type Draft } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { libraryCoreOf, type Library } from '@epd/domain/library';
import type { LibraryData, LibraryLogo, LibraryRepository } from '@/lib/repositories/types';

export interface LibraryState {
  library: Library;
  logo: LibraryLogo | null;
  /** Files set aside at start because they were invalid; shown as a notice until dismissed. */
  invalid: string[];
  /** The last write that failed (the change is on screen but not on disk); null when none. */
  writeError: string | null;
  /** Changes the library and writes the parts that changed. */
  apply(recipe: (draft: Draft<Library>) => void): void;
  setLogo(logo: LibraryLogo | null): void;
  /** Replaces the whole library (an imported `.epl`); rejects, changing nothing, when it fails. */
  replaceAll(data: LibraryData): Promise<void>;
  /** Reads the files again. */
  reload(): Promise<void>;
  dismissInvalid(): void;
  dismissWriteError(): void;
}

export type LibraryStore = StoreApi<LibraryState>;

const corePartKeys = [
  'schemaVersion',
  'company',
  'priceOverrides',
  'boxPresets',
  'defaults',
] as const;

/** Whether anything but the catalogs changed (immer keeps unchanged parts by reference). */
function coreChanged(before: Library, after: Library): boolean {
  const a = libraryCoreOf(before);
  const b = libraryCoreOf(after);
  return corePartKeys.some((key) => a[key] !== b[key]);
}

/** Creates the store with the library as the repository has it. */
export async function createLibraryStore(repository: LibraryRepository): Promise<LibraryStore> {
  const loaded = await repository.load();
  // Writes run one after the other, in the order the changes were made.
  let queue: Promise<unknown> = Promise.resolve();
  const store = createStore<LibraryState>()((set, get) => {
    function persist(task: () => Promise<void>) {
      queue = queue.then(task).then(
        () => undefined,
        (error: unknown) =>
          set({ writeError: error instanceof Error ? error.message : String(error) }),
      );
    }
    return {
      library: loaded.library,
      logo: loaded.logo,
      invalid: loaded.invalid,
      writeError: null,
      apply(recipe) {
        const before = get().library;
        const after = produce(before, recipe);
        if (after === before) return;
        set({ library: after });
        if (coreChanged(before, after)) {
          const core = libraryCoreOf(after);
          persist(() => repository.saveCore(core));
        }
        const previous = new Map(before.catalogs.map((c) => [c.id, c]));
        for (const catalog of after.catalogs) {
          if (previous.get(catalog.id) !== catalog) persist(() => repository.saveCatalog(catalog));
          previous.delete(catalog.id);
        }
        for (const id of previous.keys()) persist(() => repository.removeCatalog(id));
      },
      setLogo(logo) {
        set({ logo });
        persist(() => repository.setLogo(logo));
      },
      async replaceAll(data) {
        // Behind the pending writes, so they cannot land on the new library.
        await queue;
        await repository.replace(data);
        set({ library: data.library, logo: data.logo, writeError: null });
      },
      async reload() {
        await queue;
        const next = await repository.load();
        set({ library: next.library, logo: next.logo, invalid: next.invalid, writeError: null });
      },
      dismissInvalid: () => set({ invalid: [] }),
      dismissWriteError: () => set({ writeError: null }),
    };
  });
  return store;
}
