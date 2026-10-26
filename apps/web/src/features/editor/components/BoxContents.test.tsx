import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const planPath = `/projects/${DEMO_PROJECT_ID}/plan`;
const store = () => (window as unknown as { __epd?: { store: EditorStore } }).__epd;

async function openBox(nodeId: string) {
  const app = await renderApp(planPath, { exposeTestHandle: true });
  await screen.findByTestId('project-name');
  act(() =>
    store()!
      .store.getState()
      .setUi({ selection: [nodeId] }),
  );
  await screen.findByTestId('box-contents');
  return app;
}

describe('box contents', () => {
  // protects=AC 9 contents editing; fails_when=adding covers or the modules counter is wrong; no_claim=BOM rendering
  it('adds and removes items and counts modules', async () => {
    await openBox('n_s1');
    expect(screen.getByTestId('modules-counter')).toHaveTextContent('3 / 3 modules');
    await userEvent.selectOptions(screen.getByLabelText('Item to add'), 'builtin:switch');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByTestId('modules-counter')).toHaveTextContent('4 / 3 modules');
    await userEvent.click(screen.getByRole('button', { name: 'Remove One-way switch' }));
    await userEvent.click(screen.getByRole('button', { name: 'One more Blanking cover' }));
    const node = store()!
      .store.getState()
      .data.doc.nodes.find((n) => n.id === 'n_s1')!;
    expect(node.contents).toEqual([
      { itemId: 'builtin:socket_schuko', qty: 1 },
      { itemId: 'builtin:blanking_cover', qty: 2 },
      { itemId: 'builtin:plate_3m', qty: 1 },
    ]);
  });

  // protects=box presets; fails_when=a saved preset is not stored in the project or not applied; no_claim=placement on canvas
  it('saves the contents as a preset and applies it to another box', async () => {
    await openBox('n_s1');
    await userEvent.click(screen.getByRole('button', { name: 'Save as preset' }));
    await userEvent.type(screen.getByLabelText('Preset name'), 'Schuko 503{Enter}');
    expect(store()!.store.getState().data.boxPresets).toHaveLength(1);

    act(() =>
      store()!
        .store.getState()
        .setUi({ selection: ['n_s2'] }),
    );
    await userEvent.selectOptions(await screen.findByLabelText('Apply a preset…'), 'Schuko 503');
    const s2 = store()!
      .store.getState()
      .data.doc.nodes.find((n) => n.id === 'n_s2')!;
    expect(s2.contents?.map((c) => c.itemId)).toEqual([
      'builtin:socket_schuko',
      'builtin:blanking_cover',
      'builtin:plate_3m',
    ]);
  });
});
