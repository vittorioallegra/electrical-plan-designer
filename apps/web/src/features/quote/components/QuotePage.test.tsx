import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { builtinById } from '@epd/domain/catalog/builtin';
import { defaultLibrary } from '@epd/domain/library';
import { pdfText } from '@/testing/pdfText';
import { demoProjectFile } from '@/testing/editor';
import { renderApp } from '@/testing/renderApp';
import { pickOption } from '@/testing/select';

const quotePath = '/project/quote';
const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

const priceOf = (itemId: string) =>
  editorStore()
    .getState()
    .data.items.find((i) => i.id === itemId)?.unitPrice;

async function typeNumber(input: HTMLElement, value: string) {
  await userEvent.clear(input);
  await userEvent.type(input, `${value}{Enter}`);
}

describe('quote page', () => {
  // protects=inline prices for unpriced lines (stored on the project's item copy); fails_when=the price is not applied to the line, the totals or the price list; no_claim=how prices resolve (domain tests)
  it('prices an unpriced line inline and updates the totals', async () => {
    await renderApp(quotePath, { exposeTestHandle: true });
    expect(await screen.findByText(/lines have no price/)).toBeInTheDocument();
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€0.00');

    await typeNumber(screen.getByLabelText('Price of Wall box 503 (3 modules)'), '1.5');
    const row = (await screen.findByText('Wall box 503 (3 modules)')).closest('tr')!;
    expect(within(row).getByLabelText('Price of Wall box 503 (3 modules)')).toHaveValue('1.5');
    expect(row).toHaveTextContent('€6.00');
    // €6.00 + 22% VAT
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€7.32');
    expect(priceOf('builtin:box_503')).toBe(150);
  });

  // protects=correcting an inline price; fails_when=a price typed on the quote page can no longer be changed there; no_claim=prices in the library
  it('keeps an inline price editable after it is set', async () => {
    await renderApp(quotePath, { exposeTestHandle: true });
    await typeNumber(await screen.findByLabelText('Price of Wall box 503 (3 modules)'), '1.5');
    await typeNumber(await screen.findByLabelText('Price of Wall box 503 (3 modules)'), '2');
    const row = (await screen.findByText('Wall box 503 (3 modules)')).closest('tr')!;
    expect(row).toHaveTextContent('€8.00');
    expect(priceOf('builtin:box_503')).toBe(200);
  });

  // protects=AC 18 quote price edits stay in the project and can be undone; fails_when=a typed price reaches the library, a library price change reaches the project's quote, or undo does not restore the price; no_claim=the update-from-library dialog
  it('changes only the project when a price is typed, and undo restores it', async () => {
    const { library } = await renderApp(quotePath, { exposeTestHandle: true });
    const libraryBefore = library.getState().library;
    await typeNumber(await screen.findByLabelText('Price of Wall box 503 (3 modules)'), '1.5');
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€7.32');
    expect(library.getState().library).toBe(libraryBefore);

    // A later library price does not reprice the project.
    act(() =>
      library.getState().apply((l) => {
        l.priceOverrides['builtin:box_503'] = { unitPrice: 9900 };
      }),
    );
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€7.32');
    expect(priceOf('builtin:box_503')).toBe(150);

    act(() => editorStore().getState().undo());
    expect(priceOf('builtin:box_503')).toBeUndefined();
    expect(await screen.findByTestId('quote-total')).toHaveTextContent('€0.00');
  });

  // protects=AC 13 a project prices from its own copies; fails_when=opening it with an empty library, or after the built-in catalog changes, shows other totals than the copies give; no_claim=check 10 warnings
  it('prices from the project copies with an empty library', async () => {
    const project = demoProjectFile();
    project.items = [{ ...builtinById.get('builtin:box_503')!, unitPrice: 150 }];
    await renderApp(quotePath, { project });
    expect(await screen.findByTestId('quote-total')).toHaveTextContent('€7.32');
    expect(screen.getByLabelText('Price of Wall box 503 (3 modules)')).toHaveValue('1.5');
  });

  // protects=AC 10 company data on quotes comes from the library; fails_when=the exported quote PDF lacks the library's company or the project file carries company data; no_claim=layout and logo drawing (quotePdf.test)
  it('prints the library company on the exported quote PDF', async () => {
    const { fileAccess } = await renderApp(quotePath, {
      library: {
        library: {
          ...defaultLibrary(),
          company: { ...defaultLibrary().company, businessName: 'Elettricità Rossi' },
        },
      },
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'PDF' }))[0]!);
    await waitFor(() => expect(fileAccess.exports).toEqual(['Demo-house-quote.pdf']));
    const bytes = fileAccess.files.get('Demo-house-quote.pdf')!;
    const { text } = await pdfText(bytes.buffer as ArrayBuffer);
    expect(text.join(' ')).toContain('Elettricità Rossi');
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
    expect(await within(issued).findByText('No. 1')).toBeInTheDocument();
    expect(issued).toHaveTextContent('€110.00');

    await typeNumber(screen.getByLabelText('VAT'), '22');
    expect(screen.getByTestId('quote-total')).toHaveTextContent('€122.00');
    expect(issued).toHaveTextContent('€110.00');
  });

  // protects=quote status rules in the UI; fails_when=numbers are not per project, issuing does not supersede pending quotes, approving does not offer to reject the others, a second approval is allowed, or the note is lost; no_claim=rule edge cases (domain issuedQuotes.test)
  it('numbers quotes per project and tracks their status and note', async () => {
    await renderApp(quotePath, { exposeTestHandle: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Issue quote' }));
    await userEvent.click(screen.getByRole('button', { name: 'Issue quote' }));
    const status = (n: number) => screen.getByLabelText(`Status of quote ${n}`);
    expect(status(1)).toHaveTextContent('Superseded');
    expect(status(2)).toHaveTextContent('Issued');

    await pickOption(status(1), 'Issued');
    await pickOption(status(2), 'Approved');
    const dialog = await screen.findByRole('dialog', { name: 'Approve quote 2' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark them rejected' }));
    expect(status(2)).toHaveTextContent('Approved');
    expect(status(1)).toHaveTextContent('Rejected');

    await pickOption(status(1), 'Approved');
    expect(
      await screen.findByText('Quote 2 is approved: set it back to Issued first.'),
    ).toBeInTheDocument();
    expect(status(1)).toHaveTextContent('Rejected');

    await userEvent.type(screen.getByLabelText('Note on quote 2'), 'Signed on site');
    await userEvent.tab();
    expect(
      editorStore()
        .getState()
        .data.quote.issued.map((q) => [q.number, q.status, q.note]),
    ).toEqual([
      [1, 'rejected', ''],
      [2, 'approved', 'Signed on site'],
    ]);
  });

  // protects=CSV export wiring; fails_when=the button does not save the live quote as CSV through the save dialog; no_claim=CSV layout (quoteCsv tests)
  it('exports the live quote as CSV', async () => {
    const { fileAccess } = await renderApp(quotePath);
    const live = await screen.findByRole('group', { name: 'Export the current quote' });
    await userEvent.click(within(live).getByRole('button', { name: 'CSV' }));
    await waitFor(() => expect(fileAccess.exports).toEqual(['Demo-house-quote.csv']));
    const text = new TextDecoder().decode(fileAccess.files.get('Demo-house-quote.csv'));
    expect(text).toContain('Wall box 503 (3 modules);4;pcs;;;No price');
  });
});
