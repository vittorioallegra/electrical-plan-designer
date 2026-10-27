import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';
import { pickOption } from '@/testing/select';

const panelPath = '/project/panel';
const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;
const devices = () => store().getState().data.doc.panels[0]!.devices;

describe('panel designer', () => {
  // protects=slot placement from the palette; fails_when=a new device overlaps or lands off the rail; no_claim=drag and drop
  it('adds a device at the first free slot', async () => {
    await renderApp(panelPath, { exposeTestHandle: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Add MCB 1P+N C20' }));
    const added = devices().at(-1)!;
    expect(added).toMatchObject({ itemId: 'builtin:mcb_1pn_c20', rail: 0, slot: 7, label: 'C20' });
    expect(screen.getByTestId('device-inspector')).toBeInTheDocument();
  });

  // protects=AC 12 + check 8 in the UI; fails_when=an overlap is not shown or more rails do not fix overflow; no_claim=—
  it('flags overlaps and overflow, and a second rail fixes them', async () => {
    await renderApp(panelPath, { exposeTestHandle: true });
    await userEvent.click(await screen.findByTestId('device-d_mcb3'));
    const slot = screen.getByLabelText('Slot');
    await userEvent.clear(slot);
    await userEvent.type(slot, '6{Enter}');
    expect(screen.getByTestId('device-d_mcb3')).toHaveAttribute('data-warning', 'overlap');

    const rail = screen.getByLabelText('Rail');
    await userEvent.clear(rail);
    await userEvent.type(rail, '2{Enter}');
    expect(screen.getByTestId('device-d_mcb3')).toHaveAttribute('data-warning', 'overflow');

    await userEvent.click(screen.getByTestId('device-d_mcb3'));
    await userEvent.keyboard('{Escape}');
    store().getState().setUi({ selection: [] });
    const rails = await screen.findByLabelText('DIN rails');
    await userEvent.clear(rails);
    await userEvent.type(rails, '2{Enter}');
    expect(screen.getByTestId('device-d_mcb3')).not.toHaveAttribute('data-warning');
  });

  // protects=upstream via inspector and the enclosure suggestion; fails_when=upstream or suggested enclosure is not applied; no_claim=—
  it('sets the upstream device and applies the suggested enclosure', async () => {
    await renderApp(panelPath, { exposeTestHandle: true });
    await userEvent.click(await screen.findByTestId('device-d_mcb1'));
    await pickOption(screen.getByLabelText('Upstream device'), 'Main');
    expect(devices().find((d) => d.id === 'd_mcb1')!.upstreamDeviceId).toBe('d_main');

    store()
      .getState()
      .applyCommand('small panel', (d) => {
        d.doc.panels[0]!.enclosureItemId = undefined;
      });
    store().getState().setUi({ selection: [] });
    const layout = await screen.findByTestId('panel-layout');
    expect(layout).toHaveTextContent('Suggested: Panel enclosure 12 modules');
    await userEvent.click(within(layout).getByRole('button', { name: 'Use' }));
    expect(store().getState().data.doc.panels[0]!.enclosureItemId).toBe('builtin:enclosure_12m');
  });
});
