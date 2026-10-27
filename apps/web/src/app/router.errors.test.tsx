import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ProjectDetailsModule from '@/features/project-details/components/ProjectDetailsPage';
import { renderApp } from '@/testing/renderApp';

// A view that throws while `failDetails` is set, to exercise the route error boundaries.
const failDetails = vi.hoisted(() => ({ on: false }));
vi.mock('@/features/project-details/components/ProjectDetailsPage', async (importOriginal) => {
  const original = await importOriginal<typeof ProjectDetailsModule>();
  return {
    ProjectDetailsPage: () => {
      if (failDetails.on) throw new Error('render failed');
      return original.ProjectDetailsPage();
    },
  };
});

const projectPath = (view: string) => `/project/${view}`;

afterEach(() => {
  failDetails.on = false;
  vi.restoreAllMocks();
});

describe('route errors and loaders', () => {
  // protects=render error boundary; fails_when=a view that throws blanks the whole app; no_claim=error reporting
  it('shows the error screen when a view throws, and Retry renders it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    failDetails.on = true;
    await renderApp(projectPath('details'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    // The project frame around the failed view is still there.
    expect(screen.getByTestId('project-name')).toHaveTextContent('Demo house');

    failDetails.on = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
