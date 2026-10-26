// The project open in this tab: at most one, with its editor store and autosave.
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { DraftRepository } from '@/lib/repositories/types';
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
  /** Opens a project, replacing the open one; autosave makes the draft this project. */
  open(init: EditorInit): OpenProject;
  close(): void;
}

export type Workspace = StoreApi<WorkspaceState>;

declare global {
  interface Window {
    __epd?: { store: EditorStore };
  }
}

export function createWorkspace({
  drafts,
  exposeTestHandle = false,
}: {
  drafts: DraftRepository;
  /** Expose `window.__epd` (dev and E2E builds only). */
  exposeTestHandle?: boolean;
}): Workspace {
  let opened = 0;
  return createStore<WorkspaceState>()((set, get) => ({
    current: null,
    open(init) {
      get().close();
      const store = createEditorStore(init);
      const project = { id: ++opened, store, autosave: startAutosave(store, { drafts }) };
      if (exposeTestHandle) window.__epd = { store };
      set({ current: project });
      return project;
    },
    close() {
      const current = get().current;
      if (!current) return;
      current.autosave.stop();
      if (window.__epd?.store === current.store) delete window.__epd;
      set({ current: null });
    },
  }));
}
