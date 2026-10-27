import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';

describe('library defaults page', () => {
  // protects=AC 10 default settings; fails_when=a project setting, the VAT, the markup or a labor line edited here is not stored in the library defaults, or touches the open project; no_claim=new projects using them (step 6)
  it('edits the defaults new projects start from', async () => {
    const app = await renderApp('/settings/new-projects', { project: null });
    const waste = await screen.findByLabelText('Waste on cable and conduit');
    await userEvent.clear(waste);
    await userEvent.type(waste, '15{Enter}');
    const vat = screen.getByLabelText('VAT');
    await userEvent.clear(vat);
    await userEvent.type(vat, '10{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Lump sum' }));

    const { defaults } = app.library.getState().library;
    expect(defaults.settings.wastePercent).toBe(15);
    expect(defaults.quote.vatPercent).toBe(10);
    expect(defaults.quote.laborLines).toEqual([
      { kind: 'lump', description: 'Installation', amount: 0 },
    ]);
    await waitFor(() =>
      expect(app.libraryRepository.data.library.defaults.quote.vatPercent).toBe(10),
    );
  });
});
