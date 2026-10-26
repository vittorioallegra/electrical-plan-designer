import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { writeEpd } from '@/lib/projectFile/epd';
import type { EditorStore } from '@/stores/editor/editorStore';
import { demoProjectFile } from '@/testing/editor';
import { createDraftPresence } from '@/lib/repositories/draftPresence';
import { renderApp } from '@/testing/renderApp';

/** The demo drawing with one imported catalog, as an `.epd` file. */
function epd(): Uint8Array {
  const project = demoProjectFile();
  project.catalogs = [{ id: 'c1', name: 'Vimar 2026', importedAt: '2026-10-01', items: [] }];
  return writeEpd(project, new Map(), { appVersion: 'test', now: new Date('2026-10-26') });
}
const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function start() {
  const app = await renderApp('/', { exposeTestHandle: true });
  await screen.findByRole('heading', { name: 'Start' });
  return app;
}

describe('start screen', () => {
  // protects=new project; fails_when=a new project does not open in the editor with one floor or is not kept as a draft; no_claim=saving to a file (save.test)
  it('creates a new project and keeps it as a draft', async () => {
    const { router, drafts } = await start();
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
    expect((await drafts.get())?.project.meta).toMatchObject({
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
    expect(editorStore().getState().file).toEqual({ name: 'demo.epd', handle: 'demo.epd' });
  });

  // protects=resume draft; fails_when=the draft is not offered on start or resumes without its file and unsaved state; no_claim=IndexedDB (drafts.test)
  it('resumes the draft with its file', async () => {
    const { drafts, router } = await renderApp('/elsewhere', { exposeTestHandle: true });
    const project = demoProjectFile();
    project.meta.name = 'Draft house';
    const file = { name: 'draft.epd', handle: 'draft.epd' };
    await drafts.save({
      project,
      assets: new Map(),
      file,
      savedToFile: false,
      savedAt: '2026-10-25T10:00:00Z',
    });
    await act(() => router.navigate('/'));
    const card = await screen.findByRole('region', { name: 'Draft on this device' });
    expect(card).toHaveTextContent('Draft house');
    expect(card).toHaveTextContent('changes not saved to a file');
    await userEvent.click(within(card).getByRole('button', { name: 'Resume' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Draft house');
    expect(screen.getByTestId('save-status')).toHaveTextContent('Draft');
    expect(editorStore().getState().file).toEqual(file);
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

  // protects=new from template; fails_when=a template's catalogs and settings are not copied, or its drawing and quotes are; no_claim=logo asset (no logo in the demo file)
  it('creates a project from a template file', async () => {
    const { fileAccess } = await start();
    fileAccess.files.set('demo.epd', epd());
    fileAccess.nextOpen = 'demo.epd';
    await userEvent.click(screen.getByRole('button', { name: 'New from template…' }));
    expect(
      await screen.findByRole('dialog', { name: 'New project from demo.epd' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Project name'), 'From template');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByTestId('project-name');
    const { data, file } = editorStore().getState();
    expect(file).toBeNull();
    expect(data.meta.name).toBe('From template');
    expect(data.catalogs).toHaveLength(1);
    expect(data.doc.nodes).toEqual([]);
    expect(data.quote.issued).toEqual([]);
  });

  // protects=recent files; fails_when=a file opened before is not listed or cannot be reopened from the list; no_claim=stored handles across reloads (Chromium)
  it('lists recent files and reopens one', async () => {
    const { fileAccess, router } = await start();
    fileAccess.files.set('demo.epd', epd());
    fileAccess.nextOpen = 'demo.epd';
    await userEvent.click(screen.getByRole('button', { name: 'Open file…' }));
    await screen.findByTestId('project-name');
    await act(() => router.navigate('/'));
    const recent = await screen.findByRole('region', { name: 'Recent files' });
    await userEvent.click(within(recent).getByRole('button', { name: 'demo.epd' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/project/plan'));
  });

  // protects=project routes need an open project; fails_when=/project/... without an open project shows a broken editor; no_claim=—
  it('sends project routes to the start screen when nothing is open', async () => {
    const { router } = await renderApp('/project/quote', { project: null });
    await screen.findByRole('heading', { name: 'Start' });
    expect(router.state.location.pathname).toBe('/');
  });

  // protects=second tab; fails_when=the draft another tab is editing opens editable without asking, the read-only view can be edited, or "Edit here" does not make the other tab let go; no_claim=real browser tabs (E2E)
  it('opens the draft of another tab read-only, then takes it over', async () => {
    const otherTab = createDraftPresence({ channelName: 'start-other-tab' });
    let released = false;
    otherTab.hold(() => ({ name: 'Demo house', unsaved: false }));
    otherTab.onTakenOver(() => void (released = true));
    const { drafts, router } = await renderApp('/elsewhere', {
      exposeTestHandle: true,
      channel: 'start-other-tab',
    });
    await drafts.save({
      project: demoProjectFile(),
      assets: new Map(),
      file: null,
      savedToFile: true,
      savedAt: '2026-10-26T10:00:00Z',
    });
    await act(() => router.navigate('/'));
    const card = await screen.findByRole('region', { name: 'Draft on this device' });
    expect(await within(card).findByText('Being edited in another tab.')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Open read-only' }));
    expect(
      await screen.findByText('Read-only: this project is being edited in another tab.'),
    ).toBeInTheDocument();
    expect(editorStore().getState().readOnly).toBe(true);
    expect(released).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Edit here' }));
    await waitFor(() => expect(editorStore().getState().readOnly).toBe(false));
    expect(released).toBe(true);
    expect(screen.queryByText(/being edited in another tab/)).toBeNull();
  });

  // protects=second tab; fails_when=starting another project here silently replaces the draft another tab is editing, or does not warn that its unsaved changes are lost; no_claim=—
  it('asks before taking the draft from another tab for a new project', async () => {
    const otherTab = createDraftPresence({ channelName: 'start-new-over-tab' });
    let released = false;
    otherTab.hold(() => ({ name: 'Busy house', unsaved: true }));
    otherTab.onTakenOver(() => void (released = true));
    await renderApp('/', { channel: 'start-new-over-tab' });
    await screen.findByRole('heading', { name: 'Start' });
    await userEvent.click(screen.getByRole('button', { name: 'New project' }));
    const dialog = await screen.findByRole('dialog', { name: 'Project open in another tab' });
    expect(dialog).toHaveTextContent('“Busy house” is being edited in another tab and has changes');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue here' }));
    expect(await screen.findByRole('dialog', { name: 'New project' })).toBeInTheDocument();
    expect(released).toBe(true);
  });
});
