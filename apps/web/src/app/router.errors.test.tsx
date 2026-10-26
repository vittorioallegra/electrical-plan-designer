import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as SettingsModule from '@/features/settings/components/SettingsPage';
import { renderApp } from '@/testing/renderApp';

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

const projectPath = (view: string) => `/project/${view}`;

afterEach(() => {
  failSettings.on = false;
  vi.restoreAllMocks();
});

describe('route errors and loaders', () => {
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
});
