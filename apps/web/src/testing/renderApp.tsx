// Test helper: renders the real routes with an in-memory recovery copy and files.
import { act, render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { ProjectFile } from '@epd/domain/projectFile';
import { createRoutes } from '@/app/router';
import { createQueryClient } from '@/lib/query-client';
import { AppProviders } from '@/app/provider';
import { createI18n, type Language } from '@/lib/i18n';
import { createMemoryFileAccess } from '@/lib/repositories/fileAccess';
import { createMemoryLibraryRepository } from '@/lib/repositories/library';
import { createMemoryPreferencesRepository } from '@/lib/repositories/preferences';
import { createMemoryRecoveryRepository } from '@/lib/repositories/recovery';
import { createMemoryWindowHost } from '@/lib/repositories/windowHost';
import { createWorkspace } from '@/stores/editor/workspace';
import { createLibraryStore } from '@/stores/library/libraryStore';
import type { LibraryData } from '@/lib/repositories/types';
import { demoProjectFile } from './editor';

export async function renderApp(
  path: string,
  {
    lng = 'en',
    exposeTestHandle = false,
    project = path.startsWith('/project') ? demoProjectFile() : null,
    library: librarySeed = {},
  }: {
    lng?: Language;
    exposeTestHandle?: boolean;
    /** Opened before the first render; by default the demo project for `/project/...` paths. */
    project?: ProjectFile | null;
    /** Seeds the library (empty by default); `invalid` lists files set aside at start. */
    library?: Partial<LibraryData> & { invalid?: string[] };
  } = {},
) {
  const recovery = createMemoryRecoveryRepository();
  const fileAccess = createMemoryFileAccess();
  const windowHost = createMemoryWindowHost();
  const preferences = createMemoryPreferencesRepository();
  const libraryRepository = createMemoryLibraryRepository(librarySeed);
  const library = await createLibraryStore(libraryRepository);
  const workspace = createWorkspace({ recovery, library, exposeTestHandle });
  if (project) workspace.getState().open({ data: project });
  const queryClient = createQueryClient();
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] });
  const result = render(
    <AppProviders
      queryClient={queryClient}
      i18n={createI18n(lng)}
      services={{
        recovery,
        fileAccess,
        recent: fileAccess.recent,
        windowHost,
        preferences,
        workspace,
        library,
      }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  // Lazy route modules make the first render async: wait for it, so tests can query the page
  // right after `await renderApp()`.
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
  return {
    ...result,
    router,
    recovery,
    fileAccess,
    windowHost,
    preferences,
    workspace,
    queryClient,
    library,
    libraryRepository,
  };
}
