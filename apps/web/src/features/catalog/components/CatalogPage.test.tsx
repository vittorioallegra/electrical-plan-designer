import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';

describe('catalog page', () => {
  // protects=user items CRUD; fails_when=a new item with code and price is not stored in cents; no_claim=Supabase mapping
  it('creates a user item with code and price', async () => {
    const { control } = await renderApp('/catalog');
    await userEvent.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Brand socket');
    await userEvent.type(within(dialog).getByLabelText('Code'), 'BR-1');
    await userEvent.type(within(dialog).getByLabelText('Unit price'), '4.50');
    await userEvent.type(within(dialog).getByLabelText('Modules'), '1');
    await userEvent.selectOptions(within(dialog).getByLabelText('Device type'), 'socket');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(control.catalog.size).toBe(1));
    expect([...control.catalog.values()][0]).toMatchObject({
      name: 'Brand socket',
      code: 'BR-1',
      unitPrice: 450,
      modules: 1,
      unit: 'pcs',
      attributes: { deviceType: 'socket' },
    });
    expect(await screen.findByText('Brand socket')).toBeInTheDocument();
  });

  // protects=no dangling references; fails_when=archiving deletes the item; no_claim=—
  it('duplicates a built-in and archives the copy instead of deleting it', async () => {
    const { control } = await renderApp('/catalog');
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate Schuko socket' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Archive Schuko socket (copy)' }),
    );
    await waitFor(() => expect([...control.catalog.values()][0]!.archived).toBe(true));
    expect(screen.queryByText('Schuko socket (copy)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(screen.getByText('Schuko socket (copy)')).toBeInTheDocument();
  });

  // protects=pricing built-ins; fails_when=a built-in price is not written to the account price list; no_claim=quote math
  it('prices a built-in through the account price list', async () => {
    const { control } = await renderApp('/catalog');
    const input = await screen.findByLabelText('Price of Schuko socket');
    await userEvent.type(input, '3,90{Enter}');
    await waitFor(() =>
      expect([...control.profiles.values()][0]!.priceOverrides['builtin:socket_schuko']).toEqual({
        unitPrice: 390,
      }),
    );
  });
});
