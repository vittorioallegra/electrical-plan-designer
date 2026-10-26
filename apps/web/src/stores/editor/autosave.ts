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

  const schedule = (delay = debounceMs) => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void run(), delay);
  };

  async function run() {
    const s = store.getState();
    if (inFlight || s.readOnly || s.revision === s.draftRevision) return;
    inFlight = true;
    const revision = s.revision;
    try {
      await options.drafts.save({
        project: s.data,
        assets: usedAssets(s),
        savedToFile: s.fileRevision === revision,
        savedAt: now().toISOString(),
        recordId: s.projectId,
      });
      store.setState({ draftRevision: revision, draftFailed: false });
    } catch (e) {
      console.error(e);
      store.setState({ draftFailed: true });
    } finally {
      inFlight = false;
    }
    // Edits made during the write go in the next one.
    if (store.getState().revision !== revision && !store.getState().draftFailed) {
      if (stopped) void run();
      else schedule();
    }
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (state.revision === prev.revision || state.readOnly) return;
    if (!inFlight) schedule();
  });
  if (saveStatusOf(store.getState()) === 'unsaved') schedule(0);

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
