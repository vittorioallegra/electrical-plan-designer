import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

  // protects=Settings from the native menu; fails_when=Settings does not open /settings/general, or it closes the open project or asks the unsaved-changes question; no_claim=the Settings screen (its own tests)
  it('Settings opens General and keeps the project open', async () => {
    const { windowHost, router, workspace } = await openDemoWithEdit();
    act(() => windowHost.menuCommand({ command: 'settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/general'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(workspace.getState().current).not.toBeNull();
  });

  // protects=Export PDF, Export JSON and Import JSON from the native menu; fails_when=a command does nothing in the project frame, from Settings it does not return to the project and run, or Import JSON relies on the page's file input (which does not open without a click in the page) instead of the import dialog; no_claim=the file contents (export and import tests), the native dialog (Electron E2E)
  it('Export and Import JSON run in the project, also from Settings', async () => {
    const { windowHost, router, fileAccess } = await openDemoWithEdit();
    act(() => windowHost.menuCommand({ command: 'exportJson' }));
    await waitFor(() => expect(fileAccess.exports).toEqual(['Demo-house.json']));

    act(() => windowHost.menuCommand({ command: 'settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/general'));
    act(() => windowHost.menuCommand({ command: 'exportPdf' }));
    await waitFor(() => expect(fileAccess.exports).toEqual(['Demo-house.json', 'Demo-house.pdf']));
    expect(router.state.location.pathname).toBe('/project/plan');
    expect(router.state.location.state).toBeNull();

    const picked = vi.fn();
    screen.getByTestId('import-json').addEventListener('click', picked);
    fileAccess.nextOpen = 'Demo-house.json';
    act(() => windowHost.menuCommand({ command: 'importJson' }));
    expect(
      await screen.findByText('Project imported. Undo restores the previous version.'),
    ).toBeInTheDocument();
    expect(picked).not.toHaveBeenCalled();
  });

  // protects=the project commands need a project; fails_when=Export from the menu on the start screen navigates to a project route that is not there; no_claim=the menu enablement (menu.test)
  it('ignores Export and Import without a project', async () => {
    const { windowHost, router } = await renderApp('/', { project: null });
    await screen.findByRole('heading', { name: 'Start' });
    act(() => windowHost.menuCommand({ command: 'exportPdf' }));
    act(() => windowHost.menuCommand({ command: 'importJson' }));
    expect(router.state.location.pathname).toBe('/');
  });
});
