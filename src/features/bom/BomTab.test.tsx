import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/state/editorStore';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

describe('BOM drawer tab', () => {
  // protects=G2 live BOM in the UI; fails_when=the BOM tab misses lines or does not update after an edit; no_claim=quote prices
  it('lists the demo BOM and updates after an edit', async () => {
    await renderApp(`/projects/${DEMO_PROJECT_ID}/plan`, { exposeTestHandle: true });
    await userEvent.click(await screen.findByRole('tab', { name: 'BOM' }));
    const bom = await screen.findByTestId('bom');
    const boxes = within(bom).getByRole('region', { name: 'Wall boxes' });
    expect(boxes).toHaveTextContent('Wall box 503 (3 modules)4 pcs');
    expect(within(bom).getByRole('region', { name: 'Cable' })).toHaveTextContent(
      'Cable H07V-K 2.5 mm² brown',
    );

    act(() => {
      store()
        .getState()
        .applyCommand('remove box', (d) => {
          d.doc.segments = d.doc.segments.filter((s) => s.toNodeId !== 'n_s3');
          d.doc.nodes = d.doc.nodes.filter((n) => n.id !== 'n_s3');
        });
    });
    expect(
      within(screen.getByTestId('bom')).getByRole('region', { name: 'Wall boxes' }),
    ).toHaveTextContent('Wall box 503 (3 modules)3 pcs');
  });
});
