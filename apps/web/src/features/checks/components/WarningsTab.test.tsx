import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { openDrawer } from '@/testing/drawer';
import { renderApp } from '@/testing/renderApp';

const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;
const ui = () => store().getState().ui;

async function openWarnings() {
  await renderApp('/project/plan', { exposeTestHandle: true });
  await openDrawer('Warnings');
  return screen.findByTestId('warnings');
}

/** A bare active box on the first floor: not connected, not reached, empty. */
function addLooseBox() {
  act(() => {
    store()
      .getState()
      .applyCommand('loose box', (d) => {
        d.doc.nodes.push({
          id: 'n_loose',
          floorId: 'f1',
          kind: 'terminal_box',
          position: { x: 8, y: 2 },
          label: 'Loose box',
          status: 'active',
          mounting: 'socket',
          boxItemId: 'builtin:box_503',
          contents: [],
        });
      });
  });
}

describe('warnings tab', () => {
  // protects=rows, badge and the connectivity filter; fails_when=warnings are missing, the badge miscounts or the filter hides other checks; no_claim=check logic (domain tests)
  it('lists warnings, counts them and hides connectivity on demand', async () => {
    const tab = await openWarnings();
    expect(screen.getByTestId('warnings-badge')).toHaveTextContent('1');
    expect(
      within(tab).getByRole('row', { name: /Boxes without plate or devices/ }),
    ).toHaveTextContent('Living light');

    addLooseBox();
    expect(screen.getByTestId('warnings-badge')).toHaveTextContent('4');
    expect(within(tab).getByRole('row', { name: /Not connected to the panel/ })).toHaveTextContent(
      'Loose box',
    );
    expect(
      within(tab).getByRole('row', { name: /Boxes not reached by a circuit/ }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Hide connectivity warnings while drawing'));
    expect(screen.getByTestId('warnings-badge')).toHaveTextContent('2');
    expect(within(tab).queryByRole('row', { name: /Not connected to the panel/ })).toBeNull();
    expect(within(tab).queryByRole('row', { name: /Boxes not reached by a circuit/ })).toBeNull();
    expect(tab).toHaveTextContent('2 hidden');
    expect(within(tab).getAllByText('Loose box')).toHaveLength(1);
  });

  // protects=click-to-select on the plan; fails_when=clicking a warning does not select the element or switch to its floor; no_claim=canvas panning pixels (E2E)
  it('selects the node of a warning and switches to its floor', async () => {
    const tab = await openWarnings();
    addLooseBox();
    const row = within(tab).getByRole('row', { name: /Not connected to the panel/ });
    // Severity badge and the floor the element sits on.
    expect(row).toHaveTextContent('Warning');
    expect(row).toHaveTextContent(
      store()
        .getState()
        .data.doc.floors.find((f) => f.id === 'f1')!.name,
    );
    await userEvent.click(row);
    expect(ui().selection).toEqual(['n_loose']);
    expect(ui().floorId).toBe('f1');
  });

  // protects=circuit warnings in the UI; fails_when=a circuit warning is missing, misformatted or does not open the circuit; no_claim=—
  it('opens the circuit of a circuit warning', async () => {
    const tab = await openWarnings();
    act(() => {
      store()
        .getState()
        .applyCommand('thin sockets', (d) => {
          d.doc.circuits.find((c) => c.id === 'c2')!.crossSection = 1.5;
        });
    });
    await userEvent.click(
      within(tab).getByRole('row', {
        name: /Sockets GF: 1.5 mm² is below 2.5 mm² for Sockets/,
      }),
    );
    expect(ui().activeOwner).toEqual({ kind: 'circuit', id: 'c2' });
    expect(await screen.findByTestId('circuit-editor')).toBeInTheDocument();
  });

  // protects=panel warnings open the panel designer; fails_when=the device is not selected or the view does not change; no_claim=—
  it('opens the panel designer for a panel device warning', async () => {
    const tab = await openWarnings();
    act(() => {
      store()
        .getState()
        .applyCommand('overflow', (d) => {
          d.doc.panels[0]!.devices.find((x) => x.id === 'd_mcb3')!.rail = 3;
        });
    });
    await userEvent.click(within(tab).getByRole('row', { name: /does not fit on the DIN rails/ }));
    expect(ui().selection).toEqual(['d_mcb3']);
    expect(await screen.findByTestId('device-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('panel-front')).toBeInTheDocument();
  });
});
