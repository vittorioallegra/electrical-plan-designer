// Test helpers for the editor store.
import demo from '../../../../tests/fixtures/demo-project.json';
import { newProjectFile, type ProjectFile } from '@epd/domain/projectFile';
import type { ProjectDoc } from '@epd/domain/types';
import { createEditorStore, type EditorInit } from '@/stores/editor/editorStore';

/** The demo drawing in a new project file with default settings, named "Demo house". */
export function demoProjectFile(): ProjectFile {
  return {
    ...newProjectFile(
      {
        name: 'Demo house',
        clientName: 'Demo client',
        address: 'Via Roma 1, Milano',
        firstFloorName: 'Ground floor',
      },
      new Date('2026-10-01'),
    ),
    doc: structuredClone(demo) as ProjectDoc,
  };
}

export function demoStore(init: Partial<EditorInit> = {}) {
  return { store: createEditorStore({ data: demoProjectFile(), ...init }) };
}
