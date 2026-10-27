import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defaultLibrary } from '@epd/domain/library';
import { renderApp } from '@/testing/renderApp';

describe('library presets page', () => {
  // protects=box presets in the library; fails_when=a preset cannot be created, renamed, given a box and contents, or deleted (after a confirmation), or the changes are not written to the library; no_claim=placing boxes with a preset (step 6)
  it('creates, edits and deletes a preset', async () => {
    const app = await renderApp('/settings/presets', { project: null });
    expect(await screen.findByText('No presets yet.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New preset' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Preset name'), 'Kitchen');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    const card = await screen.findByRole('region', { name: 'Kitchen' });
    await userEvent.selectOptions(within(card).getByLabelText('Box'), 'builtin:box_504');
    await userEvent.selectOptions(
      within(card).getByLabelText('Item to add'),
      'builtin:socket_schuko',
    );
    await userEvent.click(within(card).getByRole('button', { name: 'Add' }));
    await userEvent.click(within(card).getByRole('button', { name: 'One more Schuko socket' }));
    expect(app.library.getState().library.boxPresets).toEqual([
      expect.objectContaining({
        name: 'Kitchen',
        boxItemId: 'builtin:box_504',
        contents: [{ itemId: 'builtin:socket_schuko', qty: 2 }],
      }),
    ]);

    const name = within(card).getByLabelText('Preset name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Kitchen wall');
    await userEvent.tab();
    expect(app.library.getState().library.boxPresets[0]!.name).toBe('Kitchen wall');
    await waitFor(() =>
      expect(app.libraryRepository.data.library.boxPresets[0]!.contents).toHaveLength(1),
    );

    await userEvent.click(
      within(await screen.findByRole('region', { name: 'Kitchen wall' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(app.library.getState().library.boxPresets).toEqual([]);
    expect(await screen.findByText('No presets yet.')).toBeInTheDocument();
  });

  // protects=seeded presets are listed with their content; fails_when=a seeded preset's box or lines are not shown; no_claim=editing
  it('lists a seeded preset', async () => {
    const library = defaultLibrary();
    library.boxPresets.push({
      id: 'p1',
      name: 'Bedroom',
      boxItemId: 'builtin:box_503',
      contents: [{ itemId: 'builtin:switch', qty: 1 }],
    });
    await renderApp('/settings/presets', { library: { library }, project: null });
    const card = await screen.findByRole('region', { name: 'Bedroom' });
    expect(within(card).getByLabelText('Box')).toHaveValue('builtin:box_503');
    expect(within(within(card).getByRole('list')).getByText('One-way switch')).toBeInTheDocument();
  });
});
