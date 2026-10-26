// Autosave: writes the open project to the draft, debounced, one write in flight at a time.
import { referencedAssetIds } from '@epd/domain/projectFile';
import type { DraftRepository } from '@/lib/repositories/types';
import type { ProjectAssets } from '@/lib/projectFile/epd';
import { saveStatusOf, type EditorState, type EditorStore } from './editorStore';

export interface AutosaveOptions {
  drafts: DraftRepository;
  debounceMs?: number;
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  now?: () => Date;
}

export interface Autosave {
  /** Writes the draft now (skips the debounce), e.g. on an explicit retry click. */
  flush(): void;
  /** Writes pending changes now and resolves when they are in the draft (or the write failed). */
  writeNow(): Promise<void>;
  stop(): void;
}

function usedAssets(s: EditorState): ProjectAssets {
  const assets: ProjectAssets = new Map();
  for (const id of referencedAssetIds(s.data)) {
    const asset = s.assets.get(id);
    if (asset) assets.set(id, asset);
  }
  return assets;
}

export function startAutosave(store: EditorStore, options: AutosaveOptions): Autosave {
  const debounceMs = options.debounceMs ?? 1000;
  const now = options.now ?? (() => new Date());
  const target = options.target ?? (typeof window !== 'undefined' ? window : undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let stopped = false;
  // The draft must also follow whether the data is in a file, not only the data: true at
  // start (the draft becomes this project) and after every save to a file.
  let filePending = true;

  const schedule = (delay = debounceMs) => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void run(), delay);
  };

  async function run() {
    const s = store.getState();
    if (inFlight || s.readOnly || (s.revision === s.draftRevision && !filePending)) return;
    inFlight = true;
    filePending = false;
    const revision = s.revision;
    try {
      await options.drafts.save({
        project: s.data,
        assets: usedAssets(s),
        savedToFile: s.fileRevision === revision,
        savedAt: now().toISOString(),
      });
      store.setState({ draftRevision: revision, draftFailed: false });
    } catch (e) {
      console.error(e);
      filePending = true;
      store.setState({ draftFailed: true });
    } finally {
      inFlight = false;
    }
    // Edits (or a save) made during the write go in the next one.
    const latest = store.getState();
    if ((latest.revision !== revision || filePending) && !latest.draftFailed) {
      if (stopped) void run();
      else schedule();
    }
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (state.readOnly) return;
    if (state.fileRevision !== prev.fileRevision) {
      filePending = true;
      if (!inFlight) schedule(0);
    } else if (state.revision !== prev.revision && !inFlight) {
      schedule();
    }
  });
  schedule(0);

  // Changes not in the draft yet would be lost with the tab.
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (saveStatusOf(store.getState()) === 'unsaved') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  target?.addEventListener('beforeunload', onBeforeUnload as EventListener);

  return {
    flush() {
      schedule(0);
    },
    async writeNow() {
      clearTimeout(timer);
      while (inFlight) await new Promise((resolve) => setTimeout(resolve, 10));
      await run();
    },
    /** Stops watching; changes still waiting for the debounce are written right away. */
    stop() {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
      target?.removeEventListener('beforeunload', onBeforeUnload as EventListener);
      void run();
    },
  };
}
