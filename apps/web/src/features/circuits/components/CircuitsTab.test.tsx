import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { openDrawer } from '@/testing/drawer';
import { renderApp } from '@/testing/renderApp';
import { toggleRouteSegment, toggleTarget } from '@/features/circuits/utils/commands';

const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;
const doc = () => store().getState().data.doc;

async function openCircuits() {
  await renderApp('/project/plan', { exposeTestHandle: true });
  await openDrawer('Circuits');
  return screen.findByTestId('circuits-tab');
}

describe('circuits tab', () => {
  // protects=circuit creation from the tab; fails_when=a new circuit is not added, named or opened in the editor; no_claim=device choice heuristics
  it('creates a circuit and opens it in the editor', async () => {
    const tab = await openCircuits();
    await userEvent.click(within(tab).getByRole('button', { name: 'New circuit' }));
    const created = doc().circuits.at(-1)!;
    expect(created).toMatchObject({
      name: 'Circuit 4',
      targetNodeIds: [],
      routing: { mode: 'auto' },
    });
    const editor = screen.getByTestId('circuit-editor');
    expect(within(editor).getByLabelText('Name')).toHaveValue('Circuit 4');
    expect(within(editor).getByTestId('circuit-targets')).toHaveTextContent('No targets yet.');
  });

  // protects=pick-targets mode; fails_when=the banner does not show or picked targets are not listed; no_claim=canvas hit testing (E2E)
  it('picks targets with a banner and lists them', async () => {
    const tab = await openCircuits();
    await userEvent.click(within(tab).getByRole('row', { name: /Sockets GF/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Pick targets on the plan' }));
    expect(screen.getByTestId('pick-banner')).toHaveTextContent('Sockets GF');

    act(() => void toggleTarget(store(), 'c2', 'n_sw1'));
    expect(screen.getByTestId('circuit-targets')).toHaveTextContent('Living switch');

    await userEvent.click(screen.getByRole('button', { name: 'Done picking' }));
    expect(screen.queryByTestId('pick-banner')).not.toBeInTheDocument();
  });

  // protects=picking from another page; fails_when=starting to pick targets on the panel page leaves the plan hidden; no_claim=canvas hit testing (E2E)
  it('opens the plan when target picking starts on another page', async () => {
    const { router } = await renderApp('/project/panel', {
      exposeTestHandle: true,
    });
    await openDrawer('Circuits');
    const tab = await screen.findByTestId('circuits-tab');
    await userEvent.click(within(tab).getByRole('row', { name: /Sockets GF/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Pick targets on the plan' }));
    expect(router.state.location.pathname).toBe('/project/plan');
    expect(await screen.findByTestId('pick-banner')).toHaveTextContent('Sockets GF');
  });

  // protects=manual routing status; fails_when=manual mode does not start from the auto route or a broken route is not flagged; no_claim=every route problem kind
  it('starts manual routing from the auto route and flags a broken one', async () => {
    const tab = await openCircuits();
    await userEvent.click(within(tab).getByRole('row', { name: /Lights GF/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Manual' }));
    expect(doc().circuits.find((c) => c.id === 'c1')!.routing).toEqual({
      mode: 'manual',
      segmentIds: ['s03', 's04'],
    });
    expect(screen.getByTestId('route-status')).toHaveTextContent('2 segments');

    act(() => void toggleRouteSegment(store(), { kind: 'circuit', id: 'c1' }, 's04'));
    expect(screen.getByTestId('route-status')).toHaveTextContent(
      'Route does not reach every target',
    );
  });

  // protects=two-way switch helper; fails_when=the button ignores the selection or the run lacks two travelers; no_claim=—
  it('adds two travelers between two selected boxes', async () => {
    const tab = await openCircuits();
    const twoWay = within(tab).getByRole('button', { name: 'Two-way switch' });
    expect(twoWay).toBeDisabled();
    act(() =>
      store()
        .getState()
        .setUi({ selection: ['n_sw1', 'n_s1'] }),
    );
    await userEvent.click(twoWay);
    const run = doc().extraRuns.at(-1)!;
    expect([run.fromNodeId, run.toNodeId].sort()).toEqual(['n_s1', 'n_sw1']);
    expect(run.conductors.map((c) => [c.role, c.color])).toEqual([
      ['traveler', 'black'],
      ['traveler', 'grey'],
    ]);
    const editor = screen.getByTestId('extra-run-editor');
    expect(editor).toHaveTextContent('Living switch');
    expect(editor).toHaveTextContent('Kitchen socket');
  });

  // protects=segment occupancy in the inspector; fails_when=circuit and extra-run conductors in a segment are not listed; no_claim=fill percentage
  it('shows the conductors inside a selected segment', async () => {
    await openCircuits();
    act(() =>
      store()
        .getState()
        .setUi({ selection: ['s04'] }),
    );
    const occupancy = await screen.findByTestId('segment-occupancy');
    expect(occupancy).toHaveTextContent('Conductors inside: 4');
    expect(occupancy).toHaveTextContent('Lights GF');
  });

  // protects=keyboard operation of circuit rows; fails_when=a focused row does not open its editor on Space; no_claim=mouse selection (other tests)
  it('selects a circuit row with the keyboard', async () => {
    const tab = await openCircuits();
    const row = within(tab).getByRole('row', { name: /Sockets GF/ });
    expect(row).toHaveAttribute('tabindex', '0');
    row.focus();
    await userEvent.keyboard(' ');
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(within(await screen.findByTestId('circuit-editor')).getByLabelText('Name')).toHaveValue(
      'Sockets GF',
    );
  });
});
