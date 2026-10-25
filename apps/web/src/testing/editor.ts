// Test helpers for the editor store.
import demo from '../../../../tests/fixtures/demo-project.json';
import { createMemoryRepositories } from '@/lib/repositories/memory';
import { DEV_LOGIN, seedMemory } from '@/lib/repositories/memorySeed';
import { defaultProjectSettings, defaultQuoteSettings } from '@epd/domain/defaults';
import type { ProjectDoc } from '@epd/domain/types';
import { createEditorStore } from '@/stores/editor/editorStore';

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
