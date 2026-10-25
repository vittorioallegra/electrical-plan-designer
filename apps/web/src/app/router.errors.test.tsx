import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as SettingsModule from '@/features/settings/components/SettingsPage';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

// A view that throws while `failSettings` is set, to exercise the route error boundaries.
const failSettings = vi.hoisted(() => ({ on: false }));
vi.mock('@/features/settings/components/SettingsPage', async (importOriginal) => {
  const original = await importOriginal<typeof SettingsModule>();
  return {
    SettingsPage: () => {
      if (failSettings.on) throw new Error('render failed');
      return original.SettingsPage();
    },
  };
});

const projectPath = (view: string) => `/projects/${DEMO_PROJECT_ID}/${view}`;

afterEach(() => {
  failSettings.on = false;
  vi.restoreAllMocks();
});

describe('route errors and loaders', () => {
  // protects=loader error screen; fails_when=a failed project load shows a blank page or offers no retry or way back; no_claim=network detection
  it('shows a load error with Retry and a link back, and Retry loads the project', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = true;
    await renderApp(projectPath('plan'), {
      prepare: ({ repos }) => {
        const get = repos.projects.get.bind(repos.projects);
        vi.spyOn(repos.projects, 'get').mockImplementation((id) =>
          fail ? Promise.reject(new Error('offline')) : get(id),
        );
      },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the project');
    expect(within(alert).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects',
    );

    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
  });

  // protects=render error boundary; fails_when=a view that throws blanks the whole app; no_claim=error reporting
  it('shows the error screen when a view throws, and Retry renders it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    failSettings.on = true;
    await renderApp(projectPath('settings'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    // The project frame around the failed view is still there.
    expect(screen.getByTestId('project-name')).toHaveTextContent('Demo house');

    failSettings.on = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  // protects=auth before data; fails_when=a signed-out visit runs project loaders or does not redirect to login; no_claim=session expiry while open
  it('redirects a signed-out visit to login without reading the project', async () => {
    let getProject: ReturnType<typeof vi.spyOn> | undefined;
    const { router } = await renderApp(projectPath('plan'), {
      signedIn: false,
      prepare: ({ repos }) => {
        getProject = vi.spyOn(repos.projects, 'get');
      },
    });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(projectPath('plan'))}`);
    expect(getProject).not.toHaveBeenCalled();
  });

  // protects=not-found screen; fails_when=an unknown project id shows an error or a blank editor; no_claim=—
  it('shows "Project not found" for an unknown project', async () => {
    await renderApp('/projects/00000000-0000-4000-8000-00000000ffff/plan');
    expect(await screen.findByText('Project not found.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
  });
});
