import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defaultLibraryCore } from '@epd/domain/library';
import { newProjectFile } from '@epd/domain/projectFile';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';

const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function openEmptyProject() {
  const project = newProjectFile(
    { name: 'Empty', clientName: '', address: '', firstFloorName: 'Ground floor' },
    defaultLibraryCore().defaults,
    new Date('2026-10-01'),
  );
  await renderApp('/project/plan', { exposeTestHandle: true, project });
  await screen.findByTestId('project-name');
}

describe('plan view', () => {
  // protects=a single "Import plan" per state; fails_when=the empty canvas and the Background section both offer it, or neither does once the canvas has content; no_claim=the import dialog
  it('offers Import plan once: on the empty canvas, then in the Background section', async () => {
    await openEmptyProject();
    expect(screen.getAllByRole('button', { name: 'Import plan' })).toHaveLength(1);
    expect(screen.getByTestId('empty-canvas')).toContainElement(
      screen.getByRole('button', { name: 'Import plan' }),
    );

    act(() => {
      store()
        .getState()
        .applyCommand('wall', (d) => {
          d.doc.floors[0]!.walls.push({
            id: 'w1',
            a: { x: 0, y: 0 },
            b: { x: 4, y: 0 },
            thickness: 0.2,
          });
        });
    });
    expect(screen.queryByTestId('empty-canvas')).toBeNull();
    const buttons = await screen.findAllByRole('button', { name: 'Import plan' });
    expect(buttons).toHaveLength(1);
    expect(screen.queryByTestId('empty-canvas')).toBeNull();
  });

  // protects=collapsible side panels; fails_when=the toggles do not hide and restore the floors panel and inspector, or the state leaks into the project data; no_claim=drag resize (browser E2E)
  it('collapses and restores the floors panel and the inspector', async () => {
    await openEmptyProject();
    const revision = store().getState().revision;
    expect(screen.getByRole('tab', { name: 'Ground floor' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Floors panel' }));
    expect(store().getState().ui.leftPanelOpen).toBe(false);
    expect(screen.queryByRole('tab', { name: 'Ground floor' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Floors panel' }));
    expect(screen.getByRole('tab', { name: 'Ground floor' })).toBeInTheDocument();

    // The inspector starts closed (the canvas gets the room); the toggle opens and closes it.
    expect(store().getState().ui.inspectorOpen).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Inspector' }));
    expect(store().getState().ui.inspectorOpen).toBe(true);
    expect(screen.getByText('Nothing selected.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Inspector' }));
    expect(store().getState().ui.inspectorOpen).toBe(false);
    expect(screen.getByText('Nothing selected.').closest('aside')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(store().getState().revision).toBe(revision);
  });

  // protects=the inspector opens on a selection; fails_when=selecting an object leaves the inspector closed, or an empty selection opens it; no_claim=what the inspector shows
  it('opens the inspector when something is selected', async () => {
    await openEmptyProject();
    expect(store().getState().ui.inspectorOpen).toBe(false);
    store().getState().setUi({ selection: [] });
    expect(store().getState().ui.inspectorOpen).toBe(false);
    act(() =>
      store()
        .getState()
        .setUi({ selection: ['n1'] }),
    );
    expect(store().getState().ui.inspectorOpen).toBe(true);
  });

  // protects=simplified wall inspector; fails_when=coordinates show by default, or the length field takes more than one undo or moves the start; no_claim=canvas drags (browser E2E)
  it('edits a wall by length and thickness, with coordinates in a closed section', async () => {
    await openEmptyProject();
    act(() => {
      store()
        .getState()
        .applyCommand('wall', (d) => {
          d.doc.floors[0]!.walls.push({
            id: 'w1',
            a: { x: 0, y: 0 },
            b: { x: 4, y: 0 },
            thickness: 0.2,
          });
        });
      store()
        .getState()
        .setUi({ selection: ['w1'] });
    });
    const user = userEvent.setup();
    expect(screen.getByLabelText('Length')).toHaveValue('4');
    expect(screen.getByLabelText('Thickness')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start point X')).toBeNull();

    const length = screen.getByLabelText('Length');
    await user.clear(length);
    await user.type(length, '2.5{Enter}');
    const wall = () => store().getState().data.doc.floors[0]!.walls[0]!;
    expect(wall()).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 2.5, y: 0 } });
    act(() => store().getState().undo());
    expect(wall().b).toEqual({ x: 4, y: 0 });

    await user.click(screen.getByRole('button', { name: 'Coordinates' }));
    expect(screen.getByLabelText('Start point X')).toHaveValue('0');
    expect(screen.getByLabelText('End point X')).toHaveValue('4');
  });
});
