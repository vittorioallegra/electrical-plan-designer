// Seeds the in-memory backend like supabase/seed.sql: dev user + demo project.
import demo from '../../tests/fixtures/demo-project.json';
import { defaultProjectSettings, defaultQuoteSettings } from '@/domain/defaults';
import { emptyProfile, type MemoryControl } from './memory';

export const DEV_LOGIN = { email: 'dev@example.test', password: 'devpassword' };

export function seedMemory(control: MemoryControl): void {
  const id = '00000000-0000-4000-8000-000000000001';
  control.users.set(DEV_LOGIN.email, { id, ...DEV_LOGIN });
  control.profiles.set(id, {
    ...emptyProfile(DEV_LOGIN.email),
    businessName: 'Demo Electric',
    quoteCounter: 0,
  });
  const projectId = '00000000-0000-4000-8000-0000000000aa';
  control.projects.set(projectId, {
    ownerId: id,
    meta: {
      id: projectId,
      name: 'Demo house',
      clientName: 'Demo client',
      address: 'Via Roma 1, Milano',
      updatedAt: new Date().toISOString(),
      version: 1,
    },
    settings: defaultProjectSettings(),
    quote: { settings: defaultQuoteSettings(), issued: [] },
    doc: structuredClone(demo),
  });
}
