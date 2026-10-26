import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { writeEpd } from '@/lib/projectFile/epd';
import { demoProjectFile } from '@/testing/editor';
import { renderApp } from '@/testing/renderApp';

const epd = () =>
  writeEpd(demoProjectFile(), new Map(), { appVersion: 'test', now: new Date('2026-10-26') });

async function openDemoWithEdit() {
  const app = await renderApp('/project/plan', { exposeTestHandle: true });
  await screen.findByTestId('project-name');
  await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
  return app;
}

describe('native menu commands', () => {
  // protects=AC 6 File > Open and Open Recent reuse the in-app open; fails_when=Open or Open Recent from the menu replaces a project with unsaved changes without the question, Cancel still replaces it, or a recent path does not open; no_claim=the native menu (menu.test, Electron E2E)
  it('Open and Open Recent ask the unsaved-changes question first', async () => {
    const { windowHost, fileAccess } = await openDemoWithEdit();
    fileAccess.files.set('other.epd', epd());
    fileAccess.nextOpen = 'other.epd';
    act(() => windowHost.menuCommand({ command: 'open' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(fileAccess.nextOpen).toBe('other.epd');
    expect(screen.getByTestId('save-status')).not.toHaveTextContent('Saved');

    act(() => windowHost.menuCommand({ command: 'openRecent', path: 'other.epd' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and continue' }));
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'));
    expect(await fileAccess.recent.list()).toEqual([
      { path: 'other.epd', name: 'other.epd', missing: false },
    ]);
  });

  // protects=AC 6 double-click or a second launch opens through the same question; fails_when=a file the OS asks to open replaces unsaved changes silently, or a clean project is not replaced; no_claim=the Electron events (E2E)
  it('opens a file the OS asks for, asking when there are unsaved changes', async () => {
    const { windowHost, fileAccess } = await renderApp('/', { project: null });
    await screen.findByRole('heading', { name: 'Start' });
    fileAccess.files.set('a.epd', epd());
    act(() => windowHost.openRequest('a.epd'));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');

    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    fileAccess.files.set('b.epd', epd());
    act(() => windowHost.openRequest('b.epd'));
    expect(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
    expect(fileAccess.recent).toBeDefined();
    expect((await fileAccess.recent.list()).map((f) => f.path)).toEqual(['a.epd']);
  });

  // protects=AC 6 File > New and Close project; fails_when=New from the menu does not show the new-project form, or Close project keeps the project, leaves its recovery copy after "Don't save", or skips the question; no_claim=the form's fields (start screen tests)
  it('New opens the form on the start screen; Close project asks, then returns to start', async () => {
    const { windowHost, router, recovery, workspace } = await openDemoWithEdit();
    act(() => windowHost.menuCommand({ command: 'new' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(router.state.location.pathname).toBe('/');
    expect(workspace.getState().current).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => windowHost.menuCommand({ command: 'new' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and continue' }));
    expect(await screen.findByRole('dialog', { name: 'New project' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(async () => expect(await recovery.get()).not.toBeNull());
    act(() => windowHost.menuCommand({ command: 'close' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and continue' }));
    await waitFor(() => expect(workspace.getState().current).toBeNull());
    expect(router.state.location.pathname).toBe('/');
    expect(await recovery.get()).toBeNull();
    expect(screen.queryByRole('region', { name: 'Recovered project' })).toBeNull();
  });
});
