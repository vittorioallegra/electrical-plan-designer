import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import demo from '../../../../../tests/fixtures/demo-project.json';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';

const planPath = '/project/plan';
const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

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

  // protects=draft write failure; fails_when=a failed draft write looks stored or offers no retry; no_claim=storage quotas
  it('shows a failed draft write with a retry', async () => {
    const { drafts } = await renderApp(planPath);
    const save = vi.spyOn(drafts, 'save').mockRejectedValueOnce(new Error('quota'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await userEvent.click(await screen.findByRole('button', { name: 'Add floor' }));
    expect(
      await screen.findByText('Not stored on this device', undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Draft'));
    expect(save).toHaveBeenCalledTimes(2);
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
    await renderApp('/project/settings', { lng: 'it' });
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
    await renderApp(planPath, { exposeTestHandle: true });
    await screen.findByTestId('project-name');
    const before = structuredClone(editorStore().getState().data.doc);
    const newer = { ...structuredClone(demo), schemaVersion: 99, futureField: [1, 2] };
    const file = new File([JSON.stringify(newer)], 'newer.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('import-json'), { target: { files: [file] } });
    expect(
      await screen.findByText(
        'This file was made with a newer version of the app and cannot be imported.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved');
    expect(editorStore().getState().data.doc).toEqual(before);
  });
});
