import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/state/editorStore';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function openStrip() {
  await renderApp(`/projects/${DEMO_PROJECT_ID}/plan`, { exposeTestHandle: true });
  return screen.findByRole('navigation', { name: 'Progress' });
}

describe('progress strip', () => {
  // protects=stage state from the drawing; fails_when=a finished project shows a next stage; no_claim=—
  it('marks every stage done on the demo project', async () => {
    const strip = await openStrip();
    const states = within(strip)
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-state'));
    expect(states).toEqual(['done', 'done', 'done', 'done', 'done', 'done']);
  });

  // protects=Plan stage without walls; fails_when=a plan drawn straight onto an empty floor keeps Plan as the next stage; no_claim=—
  it('counts drawn elements as a plan even without walls or background', async () => {
    const strip = await openStrip();
    const plan = within(strip).getByRole('button', { name: /Plan/ });
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
    expect(plan).toHaveAttribute('data-state', 'done');
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
    expect(plan).toHaveAttribute('aria-current', 'step');
  });

  // protects=next stage and its link; fails_when=the first unfinished stage is not marked next or does not open its tool; no_claim=—
  it('points to the first unfinished stage and opens its tool', async () => {
    const strip = await openStrip();
    act(() => {
      store()
        .getState()
        .applyCommand('no circuits', (d) => {
          d.doc.circuits = [];
          d.doc.extraRuns = [];
        });
    });
    const circuits = within(strip).getByRole('button', { name: /Circuits/ });
    expect(circuits).toHaveAttribute('aria-current', 'step');
    expect(within(strip).getByRole('button', { name: /BOM/ })).toHaveAttribute(
      'data-state',
      'todo',
    );

    store().getState().setUi({ drawerTab: 'bom' });
    await userEvent.click(circuits);
    expect(store().getState().ui.drawerTab).toBe('circuits');

    act(() => {
      store()
        .getState()
        .applyCommand('no segments', (d) => {
          d.doc.segments = [];
        });
    });
    await userEvent.click(within(strip).getByRole('button', { name: /Conduits/ }));
    expect(store().getState().ui.tool).toBe('conduit');
  });
});
