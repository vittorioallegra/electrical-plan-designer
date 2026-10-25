// Test helpers for the editor store.
import demo from '../../../../tests/fixtures/demo-project.json';
import { createMemoryRepositories } from '@/data/memory';
import { DEV_LOGIN, seedMemory } from '@/data/memorySeed';
import { defaultProjectSettings, defaultQuoteSettings } from '@/domain/defaults';
import type { ProjectDoc } from '@/domain/types';
import { createEditorStore } from './editorStore';

export const DEMO_ID = '00000000-0000-4000-8000-0000000000aa';

export async function demoStore() {
  const memory = createMemoryRepositories();
  seedMemory(memory.control);
  await memory.repos.auth.signIn(DEV_LOGIN.email, DEV_LOGIN.password);
  const record = (await memory.repos.projects.get(DEMO_ID))!;
  const store = createEditorStore({
    projectId: DEMO_ID,
    meta: record.meta,
    data: {
      doc: structuredClone(demo) as ProjectDoc,
      settings: defaultProjectSettings(),
      quote: { settings: defaultQuoteSettings(), issued: [] },
    },
  });
  return { store, ...memory };
}
