import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const quotePath = `/projects/${DEMO_PROJECT_ID}/quote`;

async function typeNumber(input: HTMLElement, value: string) {
  await userEvent.clear(input);
  await userEvent.type(input, `${value}{Enter}`);
}

describe('quote page', () => {
  // protects=inline prices for unpriced lines (stored as account overrides); fails_when=the price is not applied to the line, the totals or the price list; no_claim=price lookup order (domain tests)
  it('prices an unpriced line inline and updates the totals', async () => {
    const { repos } = await renderApp(quotePath);
    expect(await screen.findByText(/lines have no price/)).toBeInTheDocument();
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€0.00');

    await typeNumber(screen.getByLabelText('Price of Wall box 503 (3 modules)'), '1.5');
    const row = (await screen.findByText('Wall box 503 (3 modules)')).closest('tr')!;
    expect(row).toHaveTextContent('€1.50');
    expect(row).toHaveTextContent('€6.00');
    // €6.00 + 22% VAT
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€7.32');
    expect((await repos.profile.get()).priceOverrides['builtin:box_503']).toEqual({
      unitPrice: 150,
    });
  });

  // protects=labor lines, VAT and issuing (AC 15b/15c in the UI); fails_when=labor or VAT do not reach the totals, or an issued quote changes with later edits; no_claim=PDF/CSV content
  it('adds labor, changes VAT and issues a frozen numbered quote', async () => {
    await renderApp(quotePath);
    await userEvent.click(await screen.findByRole('button', { name: 'Lump sum' }));
    await typeNumber(screen.getByLabelText('Amount'), '100');
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€122.00');

    await typeNumber(screen.getByLabelText('VAT'), '10');
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€110.00');

    await userEvent.click(screen.getByRole('button', { name: 'Issue quote' }));
    const issued = screen.getByRole('region', { name: 'Issued quotes' });
    expect(await within(issued).findByText(/^\d{4}-001$/)).toBeInTheDocument();
    expect(issued).toHaveTextContent('€110.00');

    await typeNumber(screen.getByLabelText('VAT'), '22');
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€122.00');
    expect(issued).toHaveTextContent('€110.00');
  });
});
