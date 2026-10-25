import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';

describe('profile page', () => {
  // protects=business profile persistence; fails_when=edited fields are not saved; no_claim=PDF header rendering
  it('saves business fields', async () => {
    const { control } = await renderApp('/profile');
    const vat = await screen.findByLabelText('VAT number');
    await userEvent.type(vat, 'IT01234567890');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    const [profile] = [...control.profiles.values()];
    expect(profile!.vatNumber).toBe('IT01234567890');
    expect(profile!.businessName).toBe('Demo Electric');
  });
});
