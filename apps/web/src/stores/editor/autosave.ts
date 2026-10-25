// Autosave: debounced, one save in flight at a time, typed error handling.
import type { AuthRepository, ProjectRepository } from '@/lib/repositories/types';
import { SaveError } from '@/lib/repositories/types';
import type { ProjectMeta } from '@epd/domain/types';
import type { EditorData, EditorStore } from './editorStore';
import type { UnsavedStore } from './unsavedStore';

export interface AutosaveOptions {
  projects: ProjectRepository;
  auth?: AuthRepository;
  unsaved?: UnsavedStore;
  debounceMs?: number;
  /** Delays of the bounded retry for network errors. */
  retryDelaysMs?: number[];
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  /** Called after each successful save with the new meta and the data that was saved. */
  onSaved?: (meta: ProjectMeta, data: EditorData) => void;
}

export interface Autosave {
  /** Saves now (skips the debounce), e.g. on an explicit retry click. */
  flush(): void;
  stop(): void;
}

export function startAutosave(store: EditorStore, options: AutosaveOptions): Autosave {
  const debounceMs = options.debounceMs ?? 1000;
  const retryDelays = options.retryDelaysMs ?? [1000, 2000, 4000];
  const target = options.target ?? (typeof window !== 'undefined' ? window : undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let attempt = 0;
  let stopped = false;

  const schedule = (delay = debounceMs) => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), delay);
  };

  async function run() {
    const s = store.getState();
    if (stopped || inFlight || s.readOnly || s.saveStatus === 'conflict') return;
    if (s.revision === s.savedRevision) return;
    inFlight = true;
    const revision = s.revision;
    store.setState({ saveStatus: 'saving' });
    try {
      const version = await options.projects.save(
        s.projectId,
        s.version,
        s.data.doc,
        s.data.settings,
        s.data.quote,
      );
      attempt = 0;
      const now = store.getState();
      const clean = now.revision === revision;
      store.setState({
        version,
        savedRevision: revision,
        saveStatus: clean ? 'saved' : 'dirty',
        saveError: null,
        meta: { ...now.meta, version },
      });
      options.onSaved?.({ ...now.meta, version }, s.data);
      if (clean) {
        void options.unsaved?.delete(s.projectId).catch(() => undefined);
      } else {
        // Edits made during the save now sit on top of the new version: rebase the local
        // copy, or a reload would see it as stale and never offer it.
        void options.unsaved
          ?.put({
            projectId: s.projectId,
            baseVersion: version,
            data: now.data,
            savedAt: new Date().toISOString(),
          })
          .catch(() => undefined);
        schedule();
      }
    } catch (e) {
      const code = e instanceof SaveError ? e.code : 'network';
      if (code === 'version_conflict') {
        store.setState({ saveStatus: 'conflict', saveError: code });
      } else if (code === 'network' && attempt < retryDelays.length) {
        store.setState({ saveStatus: 'saving', saveError: code });
        schedule(retryDelays[attempt++]);
      } else {
        attempt = 0;
        store.setState({ saveStatus: 'error', saveError: code });
      }
    } finally {
      inFlight = false;
    }
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (state.revision === prev.revision || state.readOnly) return;
    void options.unsaved
      ?.put({
        projectId: state.projectId,
        baseVersion: state.version,
        data: state.data,
        savedAt: new Date().toISOString(),
      })
      .catch(() => undefined);
    if (state.saveStatus === 'conflict') return;
    if (state.saveStatus === 'error') store.setState({ saveStatus: 'dirty' });
    attempt = 0;
    if (!inFlight) schedule();
  });

  const onOnline = () => {
    const s = store.getState();
    if (s.saveStatus === 'error' && s.saveError === 'network') schedule(0);
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (store.getState().saveStatus !== 'saved') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  target?.addEventListener('online', onOnline);
  target?.addEventListener('beforeunload', onBeforeUnload as EventListener);
  const unsubscribeAuth = options.auth?.onChange((session) => {
    const s = store.getState();
    if (session && s.saveStatus === 'error' && s.saveError === 'auth_expired') schedule(0);
  });

  return {
    flush() {
      attempt = 0;
      schedule(0);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
      unsubscribeAuth?.();
      target?.removeEventListener('online', onOnline);
      target?.removeEventListener('beforeunload', onBeforeUnload as EventListener);
    },
  };
}
