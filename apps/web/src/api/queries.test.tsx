import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const planPath = `/projects/${DEMO_PROJECT_ID}/plan`;
const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

afterEach(() => sessionStorage.clear());

function checklistRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="checklist"] [data-key]')];
}

async function waitSaved() {
  await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'), {
    timeout: 3000,
  });
}

describe('server state (TanStack Query)', () => {
  // protects=per-line optimistic rollback; fails_when=a failed save of one line rolls back another line saved meanwhile; no_claim=server ordering
  it('rolls back only the line whose save failed', async () => {
    const { repos } = await renderApp(`/m/projects/${DEMO_PROJECT_ID}`);
    let failFirst!: (e: Error) => void;
    vi.spyOn(repos.purchases, 'set').mockImplementationOnce(
      () => new Promise<void>((_, reject) => (failFirst = reject)),
    );
    await screen.findByTestId('checklist');
    const [first, second] = checklistRows();
    await userEvent.click(within(first!).getByRole('checkbox'));
    await userEvent.click(within(second!).getByRole('checkbox'));
    await waitFor(async () =>
      expect((await repos.purchases.list(DEMO_PROJECT_ID)).get(second!.dataset.key!)).not.toBe(
        undefined,
      ),
    );
    act(() => failFirst(new Error('offline')));
    await waitFor(() => expect(first).toHaveAttribute('data-status', 'not_bought'));
    expect(second).toHaveAttribute('data-status', 'done');
  });

  // protects=no data across sessions; fails_when=the cache keeps a signed-out user's data or a new user sees it; no_claim=Supabase RLS
  it('clears the cache on sign-out so the next user never sees the previous data', async () => {
    const { repos, router, queryClient } = await renderApp('/projects');
    expect(await screen.findByRole('link', { name: /Demo house/ })).toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    await act(() => repos.auth.signOut());
    expect(queryClient.getQueryCache().getAll()).toEqual([]);

    await act(() => repos.auth.signUp('second@example.test', 'second-password'));
    await act(() => router.navigate('/projects'));
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Demo house/ })).toBeNull();
  });

  // protects=no editor across users; fails_when=another user signing in restarts the open editor and saves the first user's project as the new user; no_claim=unsaved local copies
  it('leaves an open project for the list when another user signs in', async () => {
    const { repos, router, control } = await renderApp(planPath, { exposeTestHandle: true });
    await screen.findByTestId('project-name');
    act(() =>
      editorStore()
        .getState()
        .applyCommand('rename', (d) => {
          d.doc.nodes[0]!.label = 'unsaved edit';
        }),
    );

    await act(() => repos.auth.signUp('second@example.test', 'second-password'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'));
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(screen.queryByTestId('project-name')).toBeNull();
    await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));
    expect(control.saveCalls).toEqual([]);
  });

  // protects=fresh record on re-entry; fails_when=re-opening a project after an autosave uses the old version and the next save conflicts; no_claim=concurrent devices
  it('reads a fresh record when re-entering the editor and saves without conflict', async () => {
    const { router, control } = await renderApp(planPath, { exposeTestHandle: true });
    await screen.findByTestId('project-name');
    const rename = (label: string) =>
      act(() =>
        editorStore()
          .getState()
          .applyCommand('rename', (d) => {
            d.doc.nodes[0]!.label = label;
          }),
      );
    rename('first edit');
    await waitSaved();
    const savedVersion = editorStore().getState().version;

    await act(() => router.navigate('/projects'));
    await screen.findByRole('link', { name: /Demo house/ });
    await act(() => router.navigate(planPath));
    await screen.findByTestId('project-name');
    expect(editorStore().getState().version).toBe(savedVersion);
    expect(editorStore().getState().data.doc.nodes[0]!.label).toBe('first edit');

    rename('second edit');
    await waitSaved();
    expect(control.saveCalls.at(-1)?.expectedVersion).toBe(savedVersion);
    expect(editorStore().getState().saveStatus).toBe('saved');
    // Two debounced autosaves (1 s each) plus two project loads.
  }, 15_000);
});
