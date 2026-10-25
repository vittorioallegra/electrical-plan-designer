import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import demo from '../../../tests/fixtures/demo-project.json';
import { defaultProjectSettings, defaultQuoteSettings } from '@/domain/defaults';
import type { ProjectDoc } from '@/domain/types';
import type { EditorStore } from '@/state/editorStore';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const planPath = `/projects/${DEMO_PROJECT_ID}/plan`;

describe('editor shell', () => {
  // protects=project load; fails_when=a valid project does not open with its name and "Saved"; no_claim=canvas
  it('opens the project with its name and save status', async () => {
    await renderApp(planPath);
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved');
    expect(screen.getByRole('tab', { name: 'Ground floor' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  // protects=recovery screen; fails_when=an invalid doc opens a blank editor; no_claim=repair tools
  it('shows a recovery screen with the failing path for an invalid doc', async () => {
    const { control, router } = await renderApp('/projects');
    control.projects.get(DEMO_PROJECT_ID)!.doc = { ...demo, nodes: 'broken' };
    await router.navigate(planPath);
    expect(
      await screen.findByRole('heading', { name: 'This project cannot be opened' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('doc-issues')).toHaveTextContent('nodes');
    expect(screen.getByRole('button', { name: 'Download raw JSON' })).toBeInTheDocument();
  });

  // protects=offline recovery; fails_when=a local unsaved copy is not offered after reopening; no_claim=IndexedDB itself
  it('offers to restore unsaved changes kept on this device', async () => {
    const { unsaved, router } = await renderApp('/projects');
    const doc = structuredClone(demo) as ProjectDoc;
    doc.nodes[0]!.label = 'Q1 restored';
    await unsaved.put({
      projectId: DEMO_PROJECT_ID,
      baseVersion: 1,
      data: {
        doc,
        settings: defaultProjectSettings(),
        quote: { settings: defaultQuoteSettings(), issued: [] },
      },
      savedAt: '2026-10-25T10:00:00Z',
    });
    await router.navigate(planPath);
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(screen.getByTestId('save-status')).toHaveTextContent(/Unsaved changes|Saving/);
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'), {
      timeout: 3000,
    });
  });

  // protects=conflict dialog; fails_when=a version conflict is silent or offers no way to keep local work; no_claim=merge
  it('shows the conflict dialog with a download of the local version', async () => {
    const { control } = await renderApp(planPath);
    await screen.findByTestId('project-name');
    control.projects.get(DEMO_PROJECT_ID)!.meta.version = 9;
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    expect(
      await screen.findByRole('button', { name: 'Download my version (JSON)' }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});

describe('floors', () => {
  // protects=floor management + undo; fails_when=adding or deleting a floor is not undoable; no_claim=risers on canvas
  it('adds, renames and deletes a floor, with undo', async () => {
    await renderApp(planPath);
    await userEvent.click(await screen.findByRole('button', { name: 'Add floor' }));
    expect(screen.getByRole('tab', { name: 'Floor 4' })).toHaveAttribute('aria-selected', 'true');
    const name = screen.getByLabelText('Floor name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Roof');
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Roof' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'First floor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete floor' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('3 elements');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete floor' }));
    expect(screen.queryByRole('tab', { name: 'First floor' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(await screen.findByRole('tab', { name: 'First floor' })).toBeInTheDocument();
  });
});

describe('project settings', () => {
  // protects=settings per project, undoable; fails_when=a settings edit is lost or not undoable; no_claim=AC 11 storage
  it('edits a mounting height with a comma decimal and undoes it', async () => {
    await renderApp(`/projects/${DEMO_PROJECT_ID}/settings`, { lng: 'it' });
    const input = await screen.findByLabelText('Altezza scatola prese');
    await userEvent.clear(input);
    await userEvent.type(input, '0,45{Enter}');
    expect(input).toHaveValue('0,45');
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(input).toHaveValue('0,3');
  });
});

describe('delete confirmation', () => {
  // protects=delete dialog counts; fails_when=selected node ids are counted as conduit segments (or segment ids as elements); no_claim=canvas selection (E2E)
  it('counts a selected node as an element and only its real segments', async () => {
    await renderApp(planPath, { exposeTestHandle: true });
    await screen.findByTestId('project-name');
    const store = (window as unknown as { __epd: { store: EditorStore } }).__epd.store;
    act(() => store.getState().setUi({ selection: ['n_l1'] }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText('This removes 1 element and 1 conduit segment.'),
    ).toBeInTheDocument();
  });
});

describe('JSON import', () => {
  // protects=newer-schema guard on import; fails_when=a doc from a newer app is imported, stripped of unknown fields and saved over the project; no_claim=migrations of older docs
  it('rejects a doc written by a newer app version', async () => {
    const { control } = await renderApp(planPath);
    await screen.findByTestId('project-name');
    const before = structuredClone(control.projects.get(DEMO_PROJECT_ID)!.doc);
    const newer = { ...structuredClone(demo), schemaVersion: 99, futureField: [1, 2] };
    const file = new File([JSON.stringify(newer)], 'newer.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('import-json'), { target: { files: [file] } });
    expect(
      await screen.findByText(
        'This file was made with a newer version of the app and cannot be imported.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved');
    expect(control.projects.get(DEMO_PROJECT_ID)!.doc).toEqual(before);
  });
});
