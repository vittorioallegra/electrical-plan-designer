// The project open in this tab: at most one, with its editor store and autosave.
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MemoryFileAccess } from '@/lib/repositories/fileAccess';
import type { DraftPresence, DraftRepository } from '@/lib/repositories/types';
import { startAutosave, type Autosave } from './autosave';
import { createEditorStore, saveStatusOf, type EditorInit, type EditorStore } from './editorStore';

export interface OpenProject {
  /** Distinct per opened project, e.g. as a React key. */
  id: number;
  store: EditorStore;
  autosave: Autosave;
}

/** Why the open project is read-only because of another tab. */
export type TabLock = 'in_use' | 'taken_over';

export interface WorkspaceState {
  current: OpenProject | null;
  /** `in_use`: opened as a read-only view of a draft another tab holds; `taken_over`: another
   * tab took the project over from this one. */
  tabLock: TabLock | null;
  /**
   * Opens a project, replacing the open one. An editable project makes this tab the draft's
   * holder and autosave makes the draft this project; `inUse` opens a read-only view instead.
   */
  open(init: EditorInit, options?: { inUse?: boolean }): OpenProject;
  close(): void;
}

const noPresence: DraftPresence = {
  holder: async () => null,
  claim: async () => undefined,
  hold: () => undefined,
  onTakenOver: () => () => undefined,
};

export type Workspace = StoreApi<WorkspaceState>;

declare global {
  interface Window {
    /** Test handle (dev and E2E builds): the open project's store, the fake files (E2E). */
    __epd?: { store?: EditorStore; files?: MemoryFileAccess };
    /** Set by an E2E init script to use the real file access instead of the fake. */
    __epdRealFiles?: boolean;
  }
}

export function createWorkspace({
  drafts,
  presence = noPresence,
  exposeTestHandle = false,
}: {
  drafts: DraftRepository;
  presence?: DraftPresence;
  /** Expose `window.__epd` (dev and E2E builds only). */
  exposeTestHandle?: boolean;
}): Workspace {
  let opened = 0;
  const workspace = createStore<WorkspaceState>()((set, get) => ({
    current: null,
    tabLock: null,
    open(init, { inUse = false } = {}) {
      get().close();
      const store = createEditorStore({ ...init, readOnly: (init.readOnly ?? false) || inUse });
      const project = { id: ++opened, store, autosave: startAutosave(store, { drafts }) };
      if (!store.getState().readOnly) {
        presence.hold(() => {
          const s = store.getState();
          return { name: s.data.meta.name, unsaved: saveStatusOf(s) !== 'saved' };
        });
      }
      if (exposeTestHandle) window.__epd = { ...window.__epd, store };
      set({ current: project, tabLock: inUse ? 'in_use' : null });
      return project;
    },
    close() {
      const current = get().current;
      if (!current) return;
      presence.hold(null);
      current.autosave.stop();
      if (window.__epd?.store === current.store) delete window.__epd.store;
      set({ current: null, tabLock: null });
    },
  }));
  // Another tab takes over: write what is still pending, then stop writing the draft
  // (autosave skips read-only projects). The other tab reads the draft after this.
  presence.onTakenOver(async () => {
    const current = workspace.getState().current;
    if (!current) return;
    await current.autosave.writeNow();
    current.store.setState({ readOnly: true });
    workspace.setState({ tabLock: 'taken_over' });
  });
  return workspace;
}
