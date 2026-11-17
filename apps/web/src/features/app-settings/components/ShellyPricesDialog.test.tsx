import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defaultLibrary } from '@epd/domain/library';
import { createMemoryStorePrices, sampleShellyPrices } from '@/lib/repositories/storePrices';
import { renderApp } from '@/testing/renderApp';

async function openUpdatePrices() {
  await userEvent.click(await screen.findByRole('button', { name: 'Actions for Shelly catalog' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: /Update prices/ }));
}

const rowOf = (name: string) => screen.getByRole('checkbox', { name }).closest('tr')!;

describe('Shelly prices', () => {
  // protects=Update prices end to end on the fake store; fails_when=no loading state shows while the store is asked, the store is not asked for the company country, the preview does not show net prices, unticked or failed rows are written, or the price update copies the built-in code into the override; no_claim=shelly.com itself (main tests stub the network)
  it('asks for the company country, previews net prices and applies the ticked ones', async () => {
    const library = defaultLibrary();
    library.company.country = 'DE';
    library.priceOverrides['builtin:shelly_pro_1'] = { unitPrice: 5034, code: 'FG3800235268001' };
    const memory = createMemoryStorePrices({
      ...sampleShellyPrices,
      'shelly-pro-em-50': { status: 'not_found' },
    });
    // The store answers only when released, so the loading state can be seen.
    let release!: () => void;
    const answered = new Promise<void>((resolve) => (release = resolve));
    const storePrices = {
      calls: memory.calls,
      shellyPrices: async (country: string, handles: readonly string[]) => {
        await answered;
        return memory.shellyPrices(country, handles);
      },
    };
    const app = await renderApp('/settings/catalog', { library: { library }, storePrices });
    await openUpdatePrices();

    const dialog = await screen.findByRole('dialog', { name: 'Update Shelly prices' });
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Asking shelly.com for the prices',
    );
    expect(within(dialog).getByRole('button', { name: 'Update prices' })).toBeDisabled();
    release();
    expect(within(dialog).getByText(/for Germany, without VAT \(19%\)/)).toBeInTheDocument();
    await within(dialog).findByRole('table');
    expect(storePrices.calls).toHaveLength(1);
    expect(storePrices.calls[0]!.country).toBe('DE');

    // 117.90 with 19% VAT → 99.08; Pro 1 already at its net price; EM-50 is not on the store.
    expect(rowOf('Shelly Pro 4PM')).toHaveTextContent('€99.08');
    expect(rowOf('Shelly Pro 1')).toHaveTextContent('Unchanged');
    expect(screen.getByRole('checkbox', { name: 'Shelly Pro 1' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Shelly Pro EM-50' })).toBeDisabled();
    expect(rowOf('Shelly Pro EM-50')).toHaveTextContent('Not on the store');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Shelly 1PM Mini Gen3' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update prices' }));

    const overrides = app.library.getState().library.priceOverrides;
    expect(overrides['builtin:shelly_pro_4pm']).toEqual({ unitPrice: 9908 });
    expect(overrides['builtin:shelly_2pm_gen3']?.unitPrice).toBe(1634);
    expect(overrides['builtin:shelly_1pm_mini_gen3']).toBeUndefined();
    expect(overrides['builtin:shelly_pro_em_50']).toBeUndefined();
    expect(await screen.findByText('9 prices updated.')).toBeInTheDocument();
    await waitFor(() => expect(app.libraryRepository.writes).toContain('core'));
  });

  // protects=retry after the store asks to slow down; fails_when=rate-limited rows cannot be asked again, the retry asks for more than those rows, or their prices are not ticked once they arrive; no_claim=timing between requests (main)
  it('asks again only for the rate-limited products', async () => {
    let first = true;
    const memory = createMemoryStorePrices();
    const storePrices = {
      calls: memory.calls,
      async shellyPrices(country: string, handles: readonly string[]) {
        const answers = await memory.shellyPrices(country, handles);
        if (!first) return answers;
        first = false;
        return answers.map((a, i) =>
          i >= 10 ? { handle: a.handle, status: 'rate_limited' as const } : a,
        );
      },
    };
    const app = await renderApp('/settings/catalog', { storePrices });
    await openUpdatePrices();
    await screen.findByRole('table');
    expect(rowOf('Shelly 1PM Mini Gen3')).toHaveTextContent('Store busy, try again');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(rowOf('Shelly 1PM Mini Gen3')).toHaveTextContent('New price'));
    expect(storePrices.calls[1]!.handles).toEqual(['shelly-1pm-mini-gen3', 'shelly-2pm-gen3']);
    expect(screen.getByRole('checkbox', { name: 'Shelly 2PM Gen3' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));
    expect(
      app.library.getState().library.priceOverrides['builtin:shelly_2pm_gen3']?.unitPrice,
    ).toBe(1594);
  });

  // protects=no prices for a country outside the euro; fails_when=Update prices can be opened when the company country is Other country; no_claim=the Company page
  it('disables Update prices outside the euro area', async () => {
    const library = defaultLibrary();
    library.company.country = 'other';
    await renderApp('/settings/catalog', { library: { library } });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions for Shelly catalog' }),
    );
    const action = await screen.findByRole('menuitem', { name: /Update prices/ });
    expect(action).toHaveAttribute('aria-disabled', 'true');
    expect(action).toHaveTextContent('country outside the euro');
  });
});
