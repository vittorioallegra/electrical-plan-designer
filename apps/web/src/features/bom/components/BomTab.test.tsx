import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
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

  // protects=category totals; fails_when=a category total is not the sum of its lines; no_claim=line quantities (domain tests)
  it('shows a total per category', async () => {
    await renderApp(`/projects/${DEMO_PROJECT_ID}/plan`, { exposeTestHandle: true });
    await userEvent.click(await screen.findByRole('tab', { name: 'BOM' }));
    const bom = await screen.findByTestId('bom');
    for (const region of within(bom).getAllByRole('region')) {
      const quantities = within(region)
        .getAllByRole('row')
        .map((row) => Number(row.lastElementChild!.textContent!.split(' ')[0]));
      const total = within(region).getByTestId('bom-total').textContent!;
      expect(Number(total.split(' ')[0])).toBe(quantities.reduce((a, b) => a + b, 0));
    }
    expect(within(bom).getByRole('region', { name: 'Wall boxes' })).toHaveTextContent(
      /^Wall boxes4 pcs/,
    );
  });
});
