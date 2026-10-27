import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';

const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function openControl() {
  await renderApp('/project/plan', { exposeTestHandle: true });
  return screen.findByTestId('progress-control');
}

/** Opens the stage menu and returns its items. */
async function openMenu(control: HTMLElement) {
  await userEvent.click(control);
  return within(await screen.findByRole('menu'));
}

describe('progress control', () => {
  // protects=stage state from the drawing; fails_when=a finished project shows a next stage; no_claim=—
  it('marks every stage done on the demo project', async () => {
    const control = await openControl();
    expect(control).toHaveTextContent('All stages done');
    const menu = await openMenu(control);
    const items = menu.getAllByRole('menuitem');
    expect(items).toHaveLength(6);
    for (const item of items) expect(item).toHaveAccessibleName(/, done$/);
  });

  // protects=Plan stage without walls; fails_when=a plan drawn straight onto an empty floor keeps Plan as the next stage; no_claim=—
  it('counts drawn elements as a plan even without walls or background', async () => {
    const control = await openControl();
    act(() => {
      store()
        .getState()
        .applyCommand('no walls', (d) => {
          for (const f of d.doc.floors) {
            f.walls = [];
            delete f.background;
          }
        });
    });
    expect(control).toHaveAttribute('data-next', 'none');
    act(() => {
      store()
        .getState()
        .applyCommand('empty', (d) => {
          d.doc.segments = [];
          d.doc.circuits = [];
          d.doc.extraRuns = [];
          d.doc.nodes = [];
          for (const p of d.doc.panels) p.devices = [];
        });
    });
    expect(control).toHaveAttribute('data-next', 'plan');
    expect(control).toHaveTextContent('Next: Plan');
  });

  // protects=next stage and its menu actions; fails_when=the first unfinished stage is not marked next or a stage does not open its tool or the bottom panel; no_claim=—
  it('points to the first unfinished stage and opens its tool', async () => {
    const control = await openControl();
    act(() => {
      store()
        .getState()
        .applyCommand('no circuits', (d) => {
          d.doc.circuits = [];
          d.doc.extraRuns = [];
        });
    });
    expect(control).toHaveAttribute('data-next', 'circuits');
    let menu = await openMenu(control);
    expect(menu.getByRole('menuitem', { name: 'Circuits, next' })).toBeInTheDocument();
    expect(menu.getByRole('menuitem', { name: 'BOM' })).toBeInTheDocument();

    store().getState().setUi({ drawerTab: 'bom' });
    expect(store().getState().ui.drawerOpen).toBe(false);
    await userEvent.click(menu.getByRole('menuitem', { name: 'Circuits, next' }));
    expect(store().getState().ui.drawerTab).toBe('circuits');
    expect(store().getState().ui.drawerOpen).toBe(true);

    act(() => {
      store()
        .getState()
        .applyCommand('no segments', (d) => {
          d.doc.segments = [];
        });
    });
    menu = await openMenu(control);
    await userEvent.click(menu.getByRole('menuitem', { name: /^Conduits, / }));
    expect(store().getState().ui.tool).toBe('conduit');
  });
});
