// The project open in the window: at most one, with its editor store and autosave.
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createLibrarySource, type LibrarySource } from '@epd/domain/catalog/copies';
import type { Library } from '@epd/domain/library';
import type { MemoryFileAccess } from '@/lib/repositories/fileAccess';
import type { MemoryLibraryRepository } from '@/lib/repositories/library';
import type { LibraryStore } from '@/stores/library/libraryStore';
import type { RecoveryRepository } from '@/lib/repositories/types';
import { startAutosave, type Autosave } from './autosave';
import { createEditorStore, type EditorInit, type EditorStore } from './editorStore';

export interface OpenProject {
  /** Distinct per opened project, e.g. as a React key. */
  id: number;
  store: EditorStore;
  autosave: Autosave;
}

export interface WorkspaceState {
  current: OpenProject | null;
  /** Opens a project, replacing the open one; autosave keeps the recovery copy as this project. */
  open(init: EditorInit): OpenProject;
  close(): void;
}

export type Workspace = StoreApi<WorkspaceState>;

declare global {
  interface Window {
    /**
     * Test handle (dev and E2E builds): the open project's store, the fake files and the library
     * (E2E: seed `library.repository.data`, then `library.store.getState().reload()`).
     */
    __epd?: {
      store?: EditorStore;
      files?: MemoryFileAccess;
      library?: { repository: MemoryLibraryRepository; store: LibraryStore };
    };
  }
}

export function createWorkspace({
  recovery,
  library,
  exposeTestHandle = false,
}: {
  recovery: RecoveryRepository;
  /** The library projects copy their items and prices from. */
  library: LibraryStore;
  /** Expose `window.__epd` (dev and E2E builds only). */
  exposeTestHandle?: boolean;
}): Workspace {
  let opened = 0;
  // The source is rebuilt only when the library changed.
  let cached: { library: Library; source: LibrarySource } | null = null;
  const librarySource = () => {
    const current = library.getState().library;
    if (cached?.library !== current)
      cached = { library: current, source: createLibrarySource(current) };
    return cached.source;
  };
  return createStore<WorkspaceState>()((set, get) => ({
    current: null,
    open(init) {
      get().close();
      const store = createEditorStore(init, { librarySource });
      const project = { id: ++opened, store, autosave: startAutosave(store, { recovery }) };
      if (exposeTestHandle) window.__epd = { ...window.__epd, store };
      set({ current: project });
      return project;
    },
    close() {
      const current = get().current;
      if (!current) return;
      current.autosave.stop();
      if (window.__epd?.store === current.store) delete window.__epd.store;
      set({ current: null });
    },
  }));
}
