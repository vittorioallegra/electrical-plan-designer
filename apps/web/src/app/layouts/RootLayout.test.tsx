import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRecord } from '@/lib/repositories/types';
import { renderApp } from '@/testing/renderApp';

/** The "Loading" status notice shown while a navigation is pending. */
const pendingNotice = () =>
  screen.queryAllByRole('status').find((el) => el.textContent === 'Loading…') ?? null;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('navigation feedback', () => {
  // protects=feedback while a route loader runs (opening a project on a slow network); fails_when=the old page stays without any loading sign until the loader ends; no_claim=the CSS delay before the notice shows (jsdom applies no styles)
  it('shows "Loading" while opening a project waits for its record', async () => {
    let release: () => void = () => undefined;
    await renderApp('/projects', {
      prepare: ({ repos }) => {
        const get = repos.projects.get.bind(repos.projects);
        vi.spyOn(repos.projects, 'get').mockImplementation(
          (id) =>
            new Promise<ProjectRecord | null>((resolve) => {
              release = () => resolve(get(id));
            }),
        );
      },
    });
    expect(pendingNotice()).toBeNull();

    await userEvent.click(await screen.findByRole('link', { name: /Demo house/ }));
    await waitFor(() => expect(pendingNotice()).not.toBeNull());
    // Still on the list: the notice is the only sign that the click did something.
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();

    release();
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
    await waitFor(() => expect(pendingNotice()).toBeNull());
  });
});
