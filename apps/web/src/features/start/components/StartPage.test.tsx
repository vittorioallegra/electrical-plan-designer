import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defaultLibrary, defaultLibraryCore } from '@epd/domain/library';
import { writeEpd } from '@/lib/projectFile/epd';
import type { EditorStore } from '@/stores/editor/editorStore';
import { demoProjectFile } from '@/testing/editor';
import { renderApp } from '@/testing/renderApp';

/** The demo drawing as an `.epd` file. */
function epd(): Uint8Array {
  const project = demoProjectFile();
  return writeEpd(project, new Map(), { appVersion: 'test', now: new Date('2026-10-26') });
}
const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function start() {
  const app = await renderApp('/', { exposeTestHandle: true });
  await screen.findByRole('heading', { name: 'Start' });
  return app;
}

describe('start screen', () => {
  // protects=new project; fails_when=a new project does not open in the editor with one floor or is not kept in the recovery copy; no_claim=saving to a file (save.test)
  it('creates a new project and keeps a recovery copy', async () => {
    const { router, recovery } = await start();
    await userEvent.click(screen.getByRole('button', { name: 'New project' }));
    await userEvent.type(screen.getByLabelText('Project name'), 'Casa Rossi');
    await userEvent.type(screen.getByLabelText('Client'), 'Rossi');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Casa Rossi');
    expect(router.state.location.pathname).toBe('/project/plan');
    expect(
      editorStore()
        .getState()
        .data.doc.floors.map((f) => f.name),
    ).toEqual(['Floor 1']);
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Draft'));
    expect((await recovery.get())?.project.meta).toMatchObject({
      name: 'Casa Rossi',
      clientName: 'Rossi',
    });
  });

  // protects=AC 1 open a file; fails_when=an .epd file does not open with its drawing, or a broken file opens or fails silently; no_claim=the browser file picker
  it('opens a project file and refuses a broken one', async () => {
    const { fileAccess } = await start();
    fileAccess.files.set('broken.epd', new Uint8Array([1, 2, 3]));
    fileAccess.nextOpen = 'broken.epd';
    await userEvent.click(screen.getByRole('button', { name: 'Open file…' }));
    expect(await screen.findByText('This is not a project file.')).toBeInTheDocument();

    fileAccess.files.set('demo.epd', epd());
    fileAccess.nextOpen = 'demo.epd';
    await userEvent.click(screen.getByRole('button', { name: 'Open file…' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved');
  });

  // protects=AC 9 restore; fails_when=the recovery copy is not offered on start, restores without its unsaved state or its original path, or Save then writes elsewhere; no_claim=the desktop IPC (Electron E2E)
  it('restores the recovery copy bound to its original path, still unsaved', async () => {
    const { recovery, router, fileAccess } = await renderApp('/elsewhere', {
      exposeTestHandle: true,
    });
    const project = demoProjectFile();
    project.meta.name = 'Recovered house';
    await recovery.save({
      project,
      assets: new Map(),
      file: { path: 'house.epd', name: 'house.epd', stat: { mtimeMs: 1, size: 1 } },
      savedToFile: false,
      savedAt: '2026-10-25T10:00:00Z',
    });
    await act(() => router.navigate('/'));
    const card = await screen.findByRole('region', { name: 'Recovered project' });
    expect(card).toHaveTextContent('Recovered house');
    expect(card).toHaveTextContent('File: house.epd');
    expect(card).toHaveTextContent('changes not saved to a file');
    await userEvent.click(within(card).getByRole('button', { name: 'Restore' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Recovered house');
    expect(screen.getByTestId('save-status')).toHaveTextContent('Draft');
    expect(editorStore().getState().file?.path).toBe('house.epd');

    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    // The stat of the memory file did not change (it never existed): saved in place.
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'));
    expect(fileAccess.writes).toEqual(['house.epd']);
    // Saved: nothing left to recover.
    await waitFor(async () => expect(await recovery.get()).toBeNull());
  });

  // protects=discard; fails_when=Discard deletes the copy without asking, Cancel deletes it, or the copy is still offered afterwards; no_claim=restoring (above)
  it('asks before discarding the recovery copy', async () => {
    const { recovery, router } = await renderApp('/elsewhere');
    await recovery.save({
      project: demoProjectFile(),
      assets: new Map(),
      file: null,
      savedToFile: false,
      savedAt: '2026-10-25T10:00:00Z',
    });
    await act(() => router.navigate('/'));
    const card = await screen.findByRole('region', { name: 'Recovered project' });
    expect(card).toHaveTextContent('never saved to a file');
    await userEvent.click(within(card).getByRole('button', { name: 'Discard' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard the recovered project?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await recovery.get()).not.toBeNull();

    await userEvent.click(within(card).getByRole('button', { name: 'Discard' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Recovered project' })).toBeNull(),
    );
    expect(await recovery.get()).toBeNull();
  });

  // protects=no silent loss on start; fails_when=opening a file or starting a project replaces a recovery copy with changes not in a file without asking; no_claim=the discard button (above)
  it('asks before another project replaces the recovery copy', async () => {
    const { recovery, router, fileAccess } = await renderApp('/elsewhere');
    const project = demoProjectFile();
    project.meta.name = 'Crashed house';
    await recovery.save({
      project,
      assets: new Map(),
      file: null,
      savedToFile: false,
      savedAt: '2026-10-25T10:00:00Z',
    });
    await act(() => router.navigate('/'));
    await screen.findByRole('region', { name: 'Recovered project' });
    fileAccess.files.set('demo.epd', epd());
    fileAccess.nextOpen = 'demo.epd';
    await userEvent.click(screen.getByRole('button', { name: 'Open file…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(dialog).toHaveTextContent('“Crashed house”');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard and continue' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
    // The opened file has every change: the old copy is replaced by nothing.
    await waitFor(async () => expect(await recovery.get()).toBeNull());
  });

  // protects=no silent loss; fails_when=starting another project drops changes that are not in a file without asking, or Cancel still replaces them; no_claim=server projects (editor.test)
  it('asks before replacing a project with changes not in a file', async () => {
    const { router, fileAccess } = await start();
    await userEvent.click(screen.getByRole('button', { name: 'New project' }));
    await userEvent.type(screen.getByLabelText('Project name'), 'Unsaved');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByTestId('project-name');
    await act(() => router.navigate('/'));
    expect(await screen.findByRole('region', { name: 'Open project' })).toHaveTextContent(
      'Unsaved',
    );

    fileAccess.files.set('demo.epd', epd());
    fileAccess.nextOpen = 'demo.epd';
    await userEvent.click(screen.getByRole('button', { name: 'Open file…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(dialog).toHaveTextContent('“Unsaved” has changes that are not saved to a file.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(fileAccess.nextOpen).toBe('demo.epd');

    await userEvent.click(screen.getByRole('button', { name: 'Open file…' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and continue' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
  });

  // protects=AC 7 recent files on the start screen; fails_when=an opened file is not listed, a click does not open it, a deleted file is not flagged, opening it does not explain, or Remove keeps it; no_claim=the menu's Open Recent (MenuCommands.test)
  it('lists recent files, opens one, and flags and removes a missing one', async () => {
    const { fileAccess, router } = await start();
    expect(screen.queryByRole('region', { name: 'Recent files' })).toBeNull();
    fileAccess.files.set('demo.epd', epd());
    fileAccess.files.set('other.epd', epd());
    for (const name of ['demo.epd', 'other.epd']) {
      fileAccess.nextOpen = name;
      await userEvent.click(screen.getByRole('button', { name: 'Open file…' }));
      await screen.findByTestId('project-name');
      await act(() => router.navigate('/'));
    }
    const recent = await screen.findByRole('region', { name: 'Recent files' });
    expect(
      within(recent)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['other.epdother.epd', 'demo.epddemo.epd']);

    fileAccess.files.delete('demo.epd');
    await act(() => router.navigate('/elsewhere'));
    await act(() => router.navigate('/'));
    const gone = within(await screen.findByRole('region', { name: 'Recent files' }));
    expect(await gone.findByText('missing')).toBeInTheDocument();
    await userEvent.click(gone.getByRole('button', { name: /^demo\.epd/ }));
    expect(await screen.findByText(/“demo.epd” was moved or deleted/)).toBeInTheDocument();
    await waitFor(() => expect(gone.queryByText('demo.epd')).toBeNull());

    await userEvent.click(gone.getByRole('button', { name: /^other\.epd/ }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
  });

  // protects=AC 7 removing a recent entry; fails_when=the remove button keeps the entry in the list; no_claim=a missing file (above)
  it('removes a recent file from the list', async () => {
    const { fileAccess, router } = await start();
    fileAccess.files.set('demo.epd', epd());
    await fileAccess.openPath('demo.epd');
    await act(() => router.navigate('/elsewhere'));
    await act(() => router.navigate('/'));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove from the list: demo.epd' }),
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Recent files' })).toBeNull());
    expect(await fileAccess.recent.list()).toEqual([]);
  });

  // protects=new project from the library defaults, no template; fails_when=a new project does not copy the library's settings and quote rates, there is still a template option, or the project carries library data; no_claim=the library pages
  it('creates a project from the library defaults and offers no template', async () => {
    const defaults = defaultLibraryCore().defaults;
    defaults.settings.wastePercent = 15;
    defaults.quote.vatPercent = 10;
    await renderApp('/', {
      exposeTestHandle: true,
      library: { library: { ...defaultLibrary(), defaults } },
    });
    await screen.findByRole('heading', { name: 'Start' });
    expect(screen.queryByRole('button', { name: /template/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'New project' }));
    await userEvent.type(screen.getByLabelText('Project name'), 'From defaults');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByTestId('project-name');
    const { data } = editorStore().getState();
    expect(data.meta.name).toBe('From defaults');
    expect(data.settings.wastePercent).toBe(15);
    expect(data.quote.settings.vatPercent).toBe(10);
    expect(data.items).toEqual([]);
    expect(data.doc.nodes).toEqual([]);
  });

  // protects=project routes need an open project; fails_when=/project/... without an open project shows a broken editor; no_claim=—
  it('sends project routes to the start screen when nothing is open', async () => {
    const { router } = await renderApp('/project/quote', { project: null });
    await screen.findByRole('heading', { name: 'Start' });
    expect(router.state.location.pathname).toBe('/');
  });
});
