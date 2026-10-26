// Test helper: renders the real routes with in-memory drafts and files.
import { act, render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { ProjectFile } from '@epd/domain/projectFile';
import { createRoutes } from '@/app/router';
import { createQueryClient } from '@/lib/query-client';
import { AppProviders } from '@/app/provider';
import { createI18n, type Language } from '@/lib/i18n';
import { createMemoryDraftRepository } from '@/lib/repositories/drafts';
import { createMemoryFileAccess } from '@/lib/repositories/fileAccess';
import { createWorkspace } from '@/stores/editor/workspace';
import { demoProjectFile } from './editor';

export async function renderApp(
  path: string,
  {
    lng = 'en',
    exposeTestHandle = false,
    project = path.startsWith('/project') ? demoProjectFile() : null,
  }: {
    lng?: Language;
    exposeTestHandle?: boolean;
    /** Opened before the first render; by default the demo project for `/project/...` paths. */
    project?: ProjectFile | null;
  } = {},
) {
  const drafts = createMemoryDraftRepository();
  const fileAccess = createMemoryFileAccess();
  const workspace = createWorkspace({ drafts, exposeTestHandle });
  if (project) workspace.getState().open({ data: project });
  const queryClient = createQueryClient();
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] });
  const result = render(
    <AppProviders
      queryClient={queryClient}
      i18n={createI18n(lng)}
      services={{ drafts, fileAccess, workspace }}
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
  return { ...result, router, drafts, fileAccess, workspace, queryClient };
}
