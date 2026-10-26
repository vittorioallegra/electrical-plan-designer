// Test helpers for the editor store.
import demo from '../../../../tests/fixtures/demo-project.json';
import { createMemoryRepositories } from '@/lib/repositories/memory';
import { DEV_LOGIN, seedMemory } from '@/lib/repositories/memorySeed';
import { newProjectFile } from '@epd/domain/projectFile';
import type { ProjectDoc } from '@epd/domain/types';
import { createEditorStore, type EditorInit } from '@/stores/editor/editorStore';

export const DEMO_ID = '00000000-0000-4000-8000-0000000000aa';

/** The demo drawing in a new project file with default settings. */
export function demoProjectFile() {
  return {
    ...newProjectFile(
      { name: 'Demo house', firstFloorName: 'Ground floor' },
      new Date('2026-10-01'),
    ),
    doc: structuredClone(demo) as ProjectDoc,
  };
}

export async function demoStore(init: Partial<EditorInit> = {}) {
  const memory = createMemoryRepositories();
  seedMemory(memory.control);
  await memory.repos.auth.signIn(DEV_LOGIN.email, DEV_LOGIN.password);
  const store = createEditorStore({ projectId: DEMO_ID, data: demoProjectFile(), ...init });
  return { store, ...memory };
}
