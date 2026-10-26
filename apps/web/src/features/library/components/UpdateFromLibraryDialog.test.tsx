import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { builtinById } from '@epd/domain/catalog/builtin';
import { defaultLibrary } from '@epd/domain/library';
import { demoProjectFile } from '@/testing/editor';
import { renderApp } from '@/testing/renderApp';
import type { EditorStore } from '@/stores/editor/editorStore';

const box = builtinById.get('builtin:box_503')!;
const libraryWithBoxPrice = (unitPrice: number) => ({
  library: { ...defaultLibrary(), priceOverrides: { [box.id]: { unitPrice } } },
});

async function openDialog(options: Parameters<typeof renderApp>[1]) {
  const app = await renderApp('/project/plan', options);
  await userEvent.click(await screen.findByRole('button', { name: 'Update from library' }));
  const dialog = await screen.findByRole('dialog');
  const store = app.workspace.getState().current!.store;
  return { app, dialog, store };
}
const priceOf = (store: EditorStore) =>
  store.getState().data.items.find((i) => i.id === box.id)?.unitPrice;

describe('update from library dialog', () => {
  // protects=AC 12 and the quote-typed price risk; fails_when=a price the project holds is overwritten without a tick, both prices are not shown, or undo does not restore the copy; no_claim=the diff rules (domain tests)
  it('shows both prices, starts a differing price unticked, and applies one undoable command', async () => {
    const project = demoProjectFile();
    project.items = [{ ...box, unitPrice: 150 }];
    const { dialog, store } = await openDialog({
      project,
      ...{ library: libraryWithBoxPrice(120) },
    });

    const row = within(dialog).getByText('Wall box 503 (3 modules)').closest('tr')!;
    expect(row).toHaveTextContent('€1.50');
    expect(row).toHaveTextContent('€1.20');
    const take = within(row).getByRole('checkbox');
    expect(take).not.toBeChecked();
    expect(within(dialog).getByRole('button', { name: /^Update 0/ })).toBeDisabled();

    await userEvent.click(take);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update 1 entry' }));
    expect(priceOf(store)).toBe(120);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => store.getState().undo());
    expect(priceOf(store)).toBe(150);
  });

  // protects=nothing changes without a tick; fails_when=cancelling, or applying nothing, changes the project; no_claim=the wording
  it('changes nothing when cancelled', async () => {
    const project = demoProjectFile();
    project.items = [{ ...box, unitPrice: 150 }];
    const { dialog, store } = await openDialog({ project, library: libraryWithBoxPrice(120) });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Select all' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(priceOf(store)).toBe(150);
    expect(store.getState().past).toHaveLength(0);
  });

  // protects=items gone from the library stay as they are; fails_when=a missing copy is offered for update, dropped, or not reported; no_claim=check 10 (checks tests)
  it('lists items missing from the library without offering them', async () => {
    const project = demoProjectFile();
    project.items = [
      { id: 'c1:GONE', category: 'device', name: 'Gone socket', unit: 'pcs', attributes: {} },
    ];
    const { dialog, store } = await openDialog({ project });
    const missing = within(dialog).getByRole('alert');
    expect(missing).toHaveTextContent('No longer in the library');
    expect(missing).toHaveTextContent('Gone socket');
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Update/ })).toBeNull();
    expect(store.getState().data.items).toHaveLength(1);
  });

  // protects=the up-to-date state; fails_when=a project whose copies match the library lists differences; no_claim=—
  it('says the project is up to date when nothing differs', async () => {
    const { dialog } = await openDialog({ project: demoProjectFile() });
    expect(within(dialog).getByText('The project is up to date with the library.')).toBeVisible();
  });
});
