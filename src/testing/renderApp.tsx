// Test helper: renders the real routes with in-memory repositories.
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/App';
import { AppProviders } from '@/AppProviders';
import { createMemoryRepositories } from '@/data/memory';
import { DEV_LOGIN, seedMemory } from '@/data/memorySeed';
import { createI18n, type Language } from '@/i18n';

export async function renderApp(
  path: string,
  {
    lng = 'en',
    signedIn = true,
    seed = true,
  }: { lng?: Language; signedIn?: boolean; seed?: boolean } = {},
) {
  const memory = createMemoryRepositories();
  if (seed) seedMemory(memory.control);
  if (signedIn) {
    if (!seed) await memory.repos.auth.signUp(DEV_LOGIN.email, DEV_LOGIN.password);
    else await memory.repos.auth.signIn(DEV_LOGIN.email, DEV_LOGIN.password);
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <AppProviders repos={memory.repos} i18n={createI18n(lng)}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, ...memory, router };
}
