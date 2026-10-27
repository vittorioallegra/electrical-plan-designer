import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type {
  FileAccess,
  PreferencesRepository,
  RecentRepository,
  RecoveryRepository,
  WindowHost,
} from '@/lib/repositories/types';
import type { LibraryStore } from '@/stores/library/libraryStore';
import type { Autosave } from './autosave';
import type { EditorState, EditorStore } from './editorStore';
import type { Workspace, WorkspaceState } from './workspace';

/** App-wide services of the open project, injectable for tests. */
export interface EditorServices {
  recovery: RecoveryRepository;
  fileAccess: FileAccess;
  recent: RecentRepository;
  windowHost: WindowHost;
  preferences: PreferencesRepository;
  workspace: Workspace;
  /** The app library, loaded before the first render. */
  library: LibraryStore;
}

const ServicesContext = createContext<EditorServices | null>(null);

export function EditorServicesProvider({
  services,
  children,
}: {
  services: EditorServices;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useEditorServices(): EditorServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('EditorServicesProvider missing');
  return services;
}

export function useWorkspace<T>(selector: (s: WorkspaceState) => T): T {
  return useStore(useEditorServices().workspace, selector);
}

const EditorContext = createContext<{ store: EditorStore; autosave: Autosave } | null>(null);

export function EditorProvider({
  store,
  autosave,
  children,
}: {
  store: EditorStore;
  autosave: Autosave;
  children: ReactNode;
}) {
  return <EditorContext.Provider value={{ store, autosave }}>{children}</EditorContext.Provider>;
}

export function useEditorContext() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorProvider missing');
  return ctx;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(useEditorContext().store, selector);
}
