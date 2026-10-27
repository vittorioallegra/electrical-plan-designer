import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { defaultLibrary } from '@epd/domain/library';
import type { LibraryData } from '@/lib/repositories/types';
import { renderApp } from '@/testing/renderApp';
import { pickOption } from '@/testing/select';

const planPath = '/project/plan';
const store = () => (window as unknown as { __epd?: { store: EditorStore } }).__epd;

async function openBox(nodeId: string, library?: LibraryData['library']) {
  const app = await renderApp(planPath, {
    exposeTestHandle: true,
    ...(library ? { library: { library } } : {}),
  });
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
    await pickOption(screen.getByRole('combobox', { name: 'Item to add' }), /One-way switch/);
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

  // protects=library presets apply to a box and stay out of the project; fails_when=the preset is not offered, not applied, the box offers to save one, or applying it does not copy the items it brings; no_claim=placement on canvas
  it('applies a library preset to another box, copying its items into the project', async () => {
    await openBox('n_s1', {
      ...defaultLibrary(),
      boxPresets: [
        {
          id: 'p1',
          name: 'Schuko 503',
          boxItemId: 'builtin:box_503',
          contents: [
            { itemId: 'builtin:socket_schuko', qty: 1 },
            { itemId: 'builtin:blanking_cover', qty: 2 },
            { itemId: 'builtin:plate_3m', qty: 1 },
          ],
        },
      ],
    });
    expect(screen.queryByRole('button', { name: 'Save as preset' })).toBeNull();

    act(() =>
      store()!
        .store.getState()
        .setUi({ selection: ['n_s2'] }),
    );
    await pickOption(
      await screen.findByRole('combobox', { name: 'Apply a preset…' }),
      'Schuko 503',
    );
    const { data } = store()!.store.getState();
    expect(data.doc.nodes.find((n) => n.id === 'n_s2')!.contents?.map((c) => c.itemId)).toEqual([
      'builtin:socket_schuko',
      'builtin:blanking_cover',
      'builtin:plate_3m',
    ]);
    expect(data.items.map((i) => i.id)).toEqual(
      expect.arrayContaining(['builtin:socket_schuko', 'builtin:plate_3m']),
    );
    expect('boxPresets' in data).toBe(false);
  });
});
