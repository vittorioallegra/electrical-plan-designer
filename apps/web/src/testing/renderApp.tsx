// Test helper: renders the real routes with in-memory repositories.
import { act, render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createRoutes } from '@/app/router';
import { createQueryClient } from '@/lib/query-client';
import { AppProviders } from '@/app/provider';
import { createMemoryRepositories } from '@/lib/repositories/memory';
import { DEV_LOGIN, seedMemory } from '@/lib/repositories/memorySeed';
import { createI18n, type Language } from '@/lib/i18n';
import { createMemoryUnsavedStore } from '@/stores/editor/unsavedStore';

export const DEMO_PROJECT_ID = '00000000-0000-4000-8000-0000000000aa';

export async function renderApp(
  path: string,
  {
    lng = 'en',
    signedIn = true,
    seed = true,
    exposeTestHandle = false,
    prepare,
  }: {
    lng?: Language;
    signedIn?: boolean;
    seed?: boolean;
    exposeTestHandle?: boolean;
    /** Runs before the router starts (and its loaders run), e.g. to install spies. */
    prepare?: (memory: ReturnType<typeof createMemoryRepositories>) => void;
  } = {},
) {
  const memory = createMemoryRepositories();
  if (seed) seedMemory(memory.control);
  if (signedIn) {
    if (!seed) await memory.repos.auth.signUp(DEV_LOGIN.email, DEV_LOGIN.password);
    else await memory.repos.auth.signIn(DEV_LOGIN.email, DEV_LOGIN.password);
  }
  prepare?.(memory);
  const unsaved = createMemoryUnsavedStore();
  const queryClient = createQueryClient();
  const router = createMemoryRouter(createRoutes({ repos: memory.repos, queryClient }), {
    initialEntries: [path],
  });
  const result = render(
    <AppProviders
      repos={memory.repos}
      queryClient={queryClient}
      i18n={createI18n(lng)}
      services={{ unsaved, exposeTestHandle }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  // Loaders and lazy route modules make the first render async: wait for it, so tests can
  // query the page right after `await renderApp()`.
  await act(
    () =>
      new Promise<void>((resolve) => {
        const ready = () => router.state.initialized && router.state.navigation.state === 'idle';
        if (ready()) return resolve();
        const unsubscribe = router.subscribe(() => {
          if (!ready()) return;
          unsubscribe();
          resolve();
        });
      }),
  );
  return { ...result, ...memory, router, unsaved, queryClient };
}
