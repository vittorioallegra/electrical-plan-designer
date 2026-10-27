import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defaultLibrary } from '@epd/domain/library';
import { renderApp } from '@/testing/renderApp';

let app: Awaited<ReturnType<typeof renderApp>>;
const catalogs = () => app.library.getState().library.catalogs;

async function openCatalog() {
  app = await renderApp('/settings/catalog');
  await screen.findByRole('heading', { name: 'Catalog' });
  return app;
}

/** A preset that uses these items: the library's own notion of "in use". */
const usePreset = (...itemIds: string[]) =>
  app.library.getState().apply((d) => {
    d.boxPresets.push({
      id: 'p1',
      name: 'Kitchen',
      contents: itemIds.map((itemId) => ({ itemId, qty: 1 })),
    });
  });

async function pickOption(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

/** Opens the sidebar menu of an imported catalog and chooses an action. */
async function catalogAction(catalog: string, action: string) {
  await userEvent.click(screen.getByRole('button', { name: `Actions for ${catalog}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: action }));
}

const selectRow = (name: string) => userEvent.click(screen.getByRole('gridcell', { name }));

const item = (id: string, name: string, unitPrice?: number, code = id.toUpperCase()) => ({
  id: `c1:${id}`,
  category: 'device' as const,
  name,
  code,
  ...(unitPrice !== undefined ? { unitPrice } : {}),
  unit: 'pcs' as const,
  modules: 1,
  attributes: {},
});
const withCatalog = (items: ReturnType<typeof item>[]) => ({
  library: {
    ...defaultLibrary(),
    catalogs: [{ id: 'c1', name: 'Vimar', importedAt: '2026-10-26T10:00:00.000Z', items }],
  },
});

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

describe('library catalog page', () => {
  // protects=hand-made items; fails_when=a new item is not stored in the library in cents under "My items"; no_claim=—
  it('creates an item in the library', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Brand socket');
    await userEvent.type(within(dialog).getByLabelText('Code'), 'BR-1');
    await userEvent.type(within(dialog).getByLabelText('Unit price'), '4.50');
    await userEvent.type(within(dialog).getByLabelText('Modules'), '1');
    await pickOption(within(dialog).getByRole('combobox', { name: 'Device type' }), 'Socket');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    const [own] = catalogs();
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
    // The new item is selected, so its detail opens.
    expect(await screen.findByRole('heading', { name: 'Brand socket' })).toBeInTheDocument();
    // Written through to the library files, as the one catalog file that changed.
    await waitFor(() => expect(app.libraryRepository.writes).toEqual(['catalog:own']));
  });

  // protects=no dangling references; fails_when=archiving deletes the item; no_claim=—
  it('duplicates a built-in and archives the copy instead of deleting it', async () => {
    await openCatalog();
    await selectRow('Schuko socket');
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(catalogs()[0]!.items[0]!.archived).toBe(true);
    expect(screen.queryByRole('gridcell', { name: 'Schuko socket (copy)' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(screen.getByRole('gridcell', { name: /Schuko socket \(copy\)/ })).toBeInTheDocument();
  });

  // protects=pricing built-ins in the library; fails_when=a built-in price is not written to the library's price overrides; no_claim=quote math
  it('prices a built-in in the library', async () => {
    await openCatalog();
    await selectRow('Schuko socket');
    await userEvent.type(screen.getByLabelText('Price of Schuko socket'), '3,90{Enter}');
    await waitFor(() =>
      expect(app.library.getState().library.priceOverrides['builtin:socket_schuko']).toEqual({
        unitPrice: 390,
      }),
    );
  });

  // protects=.epc import and remove; fails_when=an imported catalog is not stored in the library, or a catalog with items used by a box preset can be removed; no_claim=export download
  it('imports an .epc catalog and refuses to remove it while in use', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Import catalog…' }));
    const dialog = await chooseFile('vimar.epc', epc([socket(520)]));
    expect(within(dialog).getByLabelText('Catalog name')).toHaveValue('Vimar 2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 1 item' }));
    const [catalog] = catalogs();
    expect(catalog).toMatchObject({ name: 'Vimar 2026', source: 'vimar.epc' });
    expect(catalog!.items[0]!.id).toBe(`${catalog!.id}:V1`);
    expect(await screen.findByRole('gridcell', { name: 'Vimar socket' })).toBeInTheDocument();

    usePreset(catalog!.items[0]!.id);
    await catalogAction('Vimar 2026', 'Remove');
    expect(
      await screen.findByText(
        'Vimar 2026 cannot be removed: 1 of its items is used in a box preset.',
      ),
    ).toBeInTheDocument();
    expect(catalogs()).toHaveLength(1);
  });

  // protects=CSV import with mapping; fails_when=guessed columns, default category or modules are not applied, or rows without a name are imported; no_claim=price formats (domain tests)
  it('imports a CSV price list through the column mapping', async () => {
    await openCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Import catalog…' }));
    const csv = 'Codice;Descrizione;Prezzo\nP1;Placca 3M;2,40\nP2;;1,00\nP3;Placca 4M;3,10\n';
    const dialog = await chooseFile('bticino.csv', csv);
    expect(within(dialog).getByRole('combobox', { name: 'Name' })).toHaveTextContent('Descrizione');
    expect(within(dialog).getByText(/1 row has no name/)).toBeInTheDocument();
    await pickOption(within(dialog).getByRole('combobox', { name: 'Default category' }), 'Plates');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 2 items' }));
    const [catalog] = catalogs();
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
    const before = catalogs()[0]!;
    usePreset(before.items[0]!.id, before.items[1]!.id);

    await catalogAction('Vimar 2026', 'Replace…');
    dialog = await chooseFile('v2.epc', epc([socket(610)]));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 1 item' }));
    const diff = await screen.findByTestId('replace-diff');
    expect(diff).toHaveTextContent('1 item changed');
    expect(within(diff).getByRole('region', { name: 'Price changes' })).toHaveTextContent(
      'Vimar socket€5.20 → €6.10',
    );
    expect(diff).toHaveTextContent('Old plate');
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

    const after = catalogs()[0]!;
    expect(after.items.map((i) => [i.id, i.unitPrice, i.missing])).toEqual([
      [before.items[0]!.id, 610, undefined],
      [before.items[1]!.id, undefined, true],
    ]);
    await userEvent.click(screen.getByRole('radio', { name: 'Plates' }));
    expect(await screen.findByText('not in the new list')).toBeInTheDocument();
  });

  // protects=catalog search; fails_when=the search ignores the code, ignores the name, or is case sensitive; no_claim=ranking
  it('filters the table by name and by code', async () => {
    app = await renderApp('/settings/catalog', {
      project: null,
      library: withCatalog([
        item('a', 'Vimar plus socket', 500, 'ZX-9'),
        item('b', 'Vimar switch', 700),
      ]),
    });
    const search = await screen.findByRole('textbox', { name: 'Search by name or code' });
    await userEvent.type(search, 'plus');
    expect(screen.getByRole('gridcell', { name: 'Vimar plus socket' })).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: 'Vimar switch' })).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'zx-9');
    expect(screen.getByRole('gridcell', { name: 'Vimar plus socket' })).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: 'Vimar switch' })).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'nothing like this');
    expect(await screen.findByText('No items match.')).toBeInTheDocument();
  });

  // protects=the "without price" filter; fails_when=the badge count ignores built-in overrides, the filter keeps priced items, or pressing it again does not clear the filter; no_claim=the wording
  it('filters to the items without a price', async () => {
    app = await renderApp('/settings/catalog', {
      project: null,
      library: withCatalog([item('a', 'Priced socket', 500), item('b', 'Free socket')]),
    });
    await selectRow('Schuko socket');
    const badge = await screen.findByRole('button', { name: /without price/ });
    const before = Number(badge.textContent!.match(/\d+/)![0]);
    await userEvent.type(screen.getByLabelText('Price of Schuko socket'), '3,90{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /without price/ })).toHaveTextContent(
        `${before - 1} without price`,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /without price/ }));
    expect(screen.getByRole('gridcell', { name: 'Free socket' })).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: 'Priced socket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: 'Schuko socket' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /without price/ }));
    expect(screen.getByRole('gridcell', { name: 'Priced socket' })).toBeInTheDocument();
  });

  // protects=editing in the detail panel; fails_when=a price or field typed in the panel is not written to the item on blur/Enter, or the item is not marked as edited; no_claim=attribute fields
  it('edits the price and the fields of the selected item in the panel', async () => {
    app = await renderApp('/settings/catalog', {
      project: null,
      library: withCatalog([item('a', 'Vimar socket', 500)]),
    });
    await selectRow('Vimar socket');
    const panel = await screen.findByRole('complementary', { name: 'Item details' });
    const price = within(panel).getByLabelText('Price of Vimar socket');
    await userEvent.clear(price);
    await userEvent.type(price, '6,10{Enter}');
    await waitFor(() => expect(catalogs()[0]!.items[0]!.unitPrice).toBe(610));
    expect(catalogs()[0]!.items[0]!.editedAt).toBeDefined();
    expect(screen.getByRole('gridcell', { name: '€6.10' })).toBeInTheDocument();

    const name = within(panel).getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Vimar Plana socket');
    await userEvent.tab();
    await waitFor(() => expect(catalogs()[0]!.items[0]!.name).toBe('Vimar Plana socket'));
    // The panel has no Save button: the dialog is only for new items.
    expect(within(panel).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  // protects=panel follows the filters; fails_when=a selection hidden by a filter keeps showing its fields, or comes back empty when the filter is lifted; no_claim=the layout
  it('shows the empty state when a filter hides the selected item', async () => {
    app = await renderApp('/settings/catalog', {
      project: null,
      library: withCatalog([item('a', 'Vimar socket', 500), item('b', 'Vimar switch', 700)]),
    });
    const panel = () => screen.getByRole('complementary', { name: 'Item details' });
    expect(await within(panel()).findByText(/Select an item/)).toBeInTheDocument();
    await selectRow('Vimar socket');
    expect(within(panel()).getByRole('heading', { name: 'Vimar socket' })).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: 'Search by name or code' });
    await userEvent.type(search, 'switch');
    expect(await within(panel()).findByText(/hidden by the filters/)).toBeInTheDocument();
    await userEvent.clear(search);
    expect(
      await within(panel()).findByRole('heading', { name: 'Vimar socket' }),
    ).toBeInTheDocument();
  });

  // protects=catalog filter from the sidebar; fails_when=choosing a catalog row shows items of other catalogs, or the built-ins row shows imported ones; no_claim=import
  it('filters by the catalog chosen in the sidebar', async () => {
    app = await renderApp('/settings/catalog', {
      project: null,
      library: withCatalog([item('a', 'Vimar socket', 500)]),
    });
    await screen.findByRole('gridcell', { name: 'Schuko socket' });
    const list = screen.getByRole('list', { name: 'Catalogs' });
    await userEvent.click(within(list).getByRole('link', { name: /Vimar/ }));
    expect(await screen.findByRole('gridcell', { name: 'Vimar socket' })).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: 'Schuko socket' })).not.toBeInTheDocument();
    await userEvent.click(within(list).getByRole('link', { name: /Built-in/ }));
    expect(await screen.findByRole('gridcell', { name: 'Schuko socket' })).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: 'Vimar socket' })).not.toBeInTheDocument();
  });

  // protects=a large catalog without virtualization; fails_when=a 1,300-item catalog does not render every row, or the search over it stops working; no_claim=render time
  it('renders a catalog of 1,300 items in full and searches it', async () => {
    const many = Array.from({ length: 1300 }, (_, i) => item(`i${i}`, `Socket ${i}`, 100 + i));
    app = await renderApp('/settings/catalog', { project: null, library: withCatalog(many) });
    await screen.findByRole('gridcell', { name: 'Socket 1299' });
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1300);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search by name or code' }), 'I1299');
    await waitFor(() => expect(screen.queryByRole('gridcell', { name: 'Socket 7' })).toBeNull());
    expect(screen.getByRole('gridcell', { name: 'Socket 1299' })).toBeInTheDocument();
    // jsdom role queries over 1,300 rows take seconds; under a parallel full run the default 5s is not enough.
  }, 20_000);
});
