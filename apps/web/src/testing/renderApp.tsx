// Test helper: renders the real routes with in-memory repositories.
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/App';
import { AppProviders } from '@/AppProviders';
import { createMemoryRepositories } from '@/data/memory';
import { DEV_LOGIN, seedMemory } from '@/data/memorySeed';
import { createI18n, type Language } from '@/i18n';
import { createMemoryUnsavedStore } from '@/state/unsavedStore';

export const DEMO_PROJECT_ID = '00000000-0000-4000-8000-0000000000aa';

export async function renderApp(
  path: string,
  {
    lng = 'en',
    signedIn = true,
    seed = true,
    exposeTestHandle = false,
  }: { lng?: Language; signedIn?: boolean; seed?: boolean; exposeTestHandle?: boolean } = {},
) {
  const memory = createMemoryRepositories();
  if (seed) seedMemory(memory.control);
  if (signedIn) {
    if (!seed) await memory.repos.auth.signUp(DEV_LOGIN.email, DEV_LOGIN.password);
    else await memory.repos.auth.signIn(DEV_LOGIN.email, DEV_LOGIN.password);
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const unsaved = createMemoryUnsavedStore();
  const result = render(
    <AppProviders
      repos={memory.repos}
      i18n={createI18n(lng)}
      services={{ unsaved, exposeTestHandle }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, ...memory, router, unsaved };
}
