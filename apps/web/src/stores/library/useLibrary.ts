import { useStore } from 'zustand';
import { useEditorServices } from '@/stores/editor/EditorContext';
import type { LibraryState } from './libraryStore';

/** Reads the app library (company, catalogs, prices, presets, defaults); outside any project. */
export function useLibrary<T>(selector: (state: LibraryState) => T): T {
  return useStore(useEditorServices().library, selector);
}
