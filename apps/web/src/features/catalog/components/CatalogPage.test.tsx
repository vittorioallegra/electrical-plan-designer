import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Draft } from 'immer';
import type { ProjectFile } from '@epd/domain/projectFile';
import type { EditorStore } from '@/stores/editor/editorStore';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

/** The demo's first wall box. */
const box = (d: Draft<ProjectFile>) => d.doc.nodes.find((n) => n.id === 'n_s1')!;
const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function openCatalog() {
  const app = await renderApp(`/projects/${DEMO_PROJECT_ID}/catalog`, { exposeTestHandle: true });
  await screen.findByRole('heading', { name: 'Catalog' });
  return app;
}

async function chooseFile(name: string, content: string) {
  const dialog = await screen.findByRole('dialog');
  await userEvent.upload(within(dialog).getByTestId('catalog-file'), new File([content], name));
  return dialog;
}

const epc = (items: object[]) =>
  JSON.stringify({ format: 'epc', schemaVersion: 1, name: 'Vimar 2026', items });
const socket = (unitPrice: number) => ({
  category: 'device',
  name: 'Vimar socket',
  code: 'V1',
  unitPrice,
  unit: 'pcs',
  modules: 1,
  attributes: { deviceType: 'socket' },
});

describe('project catalog page', () => {
  // protects=hand-made items; fails_when=a new item is not stored in the project in cents under "My items"; no_claim=—
  it('creates an item in the project', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Brand socket');
    await userEvent.type(within(dialog).getByLabelText('Code'), 'BR-1');
    await userEvent.type(within(dialog).getByLabelText('Unit price'), '4.50');
    await userEvent.type(within(dialog).getByLabelText('Modules'), '1');
    await userEvent.selectOptions(within(dialog).getByLabelText('Device type'), 'socket');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    const [own] = editorStore().getState().data.catalogs;
    expect(own).toMatchObject({ id: 'own', name: 'My items' });
    expect(own!.items).toEqual([
      expect.objectContaining({
        id: 'own:BR-1',
        name: 'Brand socket',
        unitPrice: 450,
        modules: 1,
        attributes: { deviceType: 'socket' },
      }),
    ]);
    expect(await screen.findByText('Brand socket')).toBeInTheDocument();
  });

  // protects=no dangling references; fails_when=archiving deletes the item; no_claim=—
  it('duplicates a built-in and archives the copy instead of deleting it', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Schuko socket' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Archive Schuko socket (copy)' }),
    );
    expect(editorStore().getState().data.catalogs[0]!.items[0]!.archived).toBe(true);
    expect(screen.queryByText('Schuko socket (copy)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(screen.getByText('Schuko socket (copy)')).toBeInTheDocument();
  });

  // protects=pricing built-ins per project; fails_when=a built-in price is not written to the project's price overrides; no_claim=quote math
  it('prices a built-in in the project', async () => {
    await openCatalog();
    await userEvent.type(screen.getByLabelText('Price of Schuko socket'), '3,90{Enter}');
    await waitFor(() =>
      expect(editorStore().getState().data.priceOverrides['builtin:socket_schuko']).toEqual({
        unitPrice: 390,
      }),
    );
  });

  // protects=.epc import and remove; fails_when=an imported catalog is not copied into the project, or a catalog with items in use can be removed; no_claim=export download
  it('imports an .epc catalog and refuses to remove it while in use', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Import catalog…' }));
    const dialog = await chooseFile('vimar.epc', epc([socket(520)]));
    expect(within(dialog).getByLabelText('Catalog name')).toHaveValue('Vimar 2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 1 item' }));
    const [catalog] = editorStore().getState().data.catalogs;
    expect(catalog).toMatchObject({ name: 'Vimar 2026', source: 'vimar.epc' });
    expect(catalog!.items[0]!.id).toBe(`${catalog!.id}:V1`);
    expect(await screen.findByText('Vimar socket')).toBeInTheDocument();

    editorStore()
      .getState()
      .applyCommand('use', (d) => {
        box(d).contents!.push({ itemId: catalog!.items[0]!.id, qty: 1 });
      });
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText(
        'Vimar 2026 cannot be removed: 1 of its items is used in the project.',
      ),
    ).toBeInTheDocument();
    expect(editorStore().getState().data.catalogs).toHaveLength(1);
  });

  // protects=CSV import with mapping; fails_when=guessed columns, default category or modules are not applied, or rows without a name are imported; no_claim=price formats (domain tests)
  it('imports a CSV price list through the column mapping', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Import catalog…' }));
    const csv = 'Codice;Descrizione;Prezzo\nP1;Placca 3M;2,40\nP2;;1,00\nP3;Placca 4M;3,10\n';
    const dialog = await chooseFile('bticino.csv', csv);
    expect(within(dialog).getByLabelText('Name')).toHaveValue('1');
    expect(within(dialog).getByText(/1 row has no name/)).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText('Default category'), 'plate');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 2 items' }));
    const [catalog] = editorStore().getState().data.catalogs;
    expect(catalog!.name).toBe('bticino');
    expect(catalog!.items.map((i) => [i.code, i.category, i.unitPrice])).toEqual([
      ['P1', 'plate', 240],
      ['P3', 'plate', 310],
    ]);
  });

  // protects=replace with diff; fails_when=the diff hides price changes or items in use missing from the new list, or the replace loses ids or drops items in use; no_claim=hand-edit conflicts (domain tests)
  it('replaces a catalog after showing the diff', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Import catalog…' }));
    const plate = { category: 'plate', name: 'Old plate', code: 'P9', unit: 'pcs', attributes: {} };
    let dialog = await chooseFile('v1.epc', epc([socket(520), plate]));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 2 items' }));
    const before = editorStore().getState().data.catalogs[0]!;
    editorStore()
      .getState()
      .applyCommand('use', (d) => {
        box(d).contents!.push({ itemId: before.items[0]!.id, qty: 1 });
        box(d).contents!.push({ itemId: before.items[1]!.id, qty: 1 });
      });

    await userEvent.click(screen.getByRole('button', { name: 'Replace…' }));
    dialog = await chooseFile('v2.epc', epc([socket(610)]));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 1 item' }));
    const diff = await screen.findByTestId('replace-diff');
    expect(diff).toHaveTextContent('1 item changed');
    expect(within(diff).getByRole('region', { name: 'Price changes' })).toHaveTextContent(
      'Vimar socket€5.20 → €6.10',
    );
    expect(diff).toHaveTextContent('Old plate');
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

    const after = editorStore().getState().data.catalogs[0]!;
    expect(after.items.map((i) => [i.id, i.unitPrice, i.missing])).toEqual([
      [before.items[0]!.id, 610, undefined],
      [before.items[1]!.id, undefined, true],
    ]);
    await userEvent.click(screen.getByRole('tab', { name: 'Plates' }));
    expect(await screen.findByText('not in the new list')).toBeInTheDocument();
  });
});
