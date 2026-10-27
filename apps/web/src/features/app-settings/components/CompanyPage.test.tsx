import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';

describe('library company page', () => {
  // protects=AC 10 company data in the library; fails_when=fields or the logo are not stored in the library (and written to its files), the logo is accepted with the wrong content or type, or removing it keeps the file; no_claim=quote PDF layout (quotePdf.test)
  it('edits the company and stores the logo in the library', async () => {
    const app = await renderApp('/settings/company');
    await userEvent.type(await screen.findByLabelText('Business name'), 'Elettricità Rossi');
    await userEvent.tab();
    expect(app.library.getState().library.company.businessName).toBe('Elettricità Rossi');
    await waitFor(() => expect(app.libraryRepository.writes).toEqual(['core']));

    const fake = new File([new Uint8Array([1, 2, 3, 4])], 'fake.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Logo'), fake);
    expect(await screen.findByText('The logo must be a PNG or JPG image.')).toBeInTheDocument();
    expect(app.library.getState().logo).toBeNull();

    const logo = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Logo'), logo);
    await waitFor(() => expect(app.library.getState().logo).not.toBeNull());
    expect([...app.library.getState().logo!.bytes]).toEqual([137, 80, 78, 71]);
    await waitFor(() => expect(app.libraryRepository.data.logo?.mimeType).toBe('image/png'));

    await userEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    await waitFor(() => expect(app.libraryRepository.data.logo).toBeNull());
  });

  // protects=the page shows what the library holds; fails_when=a seeded company is not shown in the fields; no_claim=editing
  it('shows the stored company', async () => {
    const { defaultLibrary } = await import('@epd/domain/library');
    const library = defaultLibrary();
    library.company.vatNumber = 'IT01234567890';
    await renderApp('/settings/company', { library: { library } });
    expect(await screen.findByLabelText('VAT number')).toHaveValue('IT01234567890');
  });
});
