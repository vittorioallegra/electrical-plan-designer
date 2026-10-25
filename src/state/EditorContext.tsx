import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { Autosave } from './autosave';
import type { EditorState, EditorStore } from './editorStore';
import { createIndexedDbUnsavedStore, type UnsavedStore } from './unsavedStore';

/** App-wide editor services, injectable for tests. */
export interface EditorServices {
  unsaved: UnsavedStore;
  /** Expose `window.__epd` (dev and E2E builds only). */
  exposeTestHandle: boolean;
}

const ServicesContext = createContext<EditorServices | null>(null);

let defaultServices: EditorServices | undefined;

export function EditorServicesProvider({
  services,
  children,
}: {
  services?: EditorServices;
  children: ReactNode;
}) {
  defaultServices ??= { unsaved: createIndexedDbUnsavedStore(), exposeTestHandle: false };
  return (
    <ServicesContext.Provider value={services ?? defaultServices}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useEditorServices(): EditorServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('EditorServicesProvider missing');
  return services;
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
