import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { defaultLibrary, type Library } from '@epd/domain/library';
import { writeEpl } from '@/lib/libraryFile/epl';
import { renderApp } from '@/testing/renderApp';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]);
const filled = (): Library => ({
  ...defaultLibrary(),
  company: { ...defaultLibrary().company, businessName: 'Rossi' },
  catalogs: [{ id: 'c1', name: 'Vimar', importedAt: '2026-10-26T10:00:00.000Z', items: [] }],
});

describe('library frame', () => {
  // protects=AC 10 library reachable and the project kept open; fails_when=the library cannot be opened from the start screen or from a project, the open project is closed by visiting it, or the link back does not return to it; no_claim=the project pages themselves
  it('is reachable from the start screen and the project, and links back', async () => {
    const app = await renderApp('/project/plan');
    await userEvent.click(await screen.findByRole('link', { name: 'Library' }));
    expect(await screen.findByRole('heading', { name: 'Company' })).toBeInTheDocument();
    expect(app.workspace.getState().current).not.toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Back to Demo house' }));
    expect(await screen.findByTestId('project-name')).toHaveTextContent('Demo house');
    expect(app.workspace.getState().current).not.toBeNull();

    const start = await renderApp('/', { project: null });
    await userEvent.click(await within(start.container).findByRole('button', { name: 'Library' }));
    expect(await screen.findByRole('link', { name: 'Back to start' })).toBeInTheDocument();
  });

  // protects=AC 10 notice for invalid files; fails_when=files set aside at start are not announced, or the notice cannot be dismissed; no_claim=the renaming itself (main tests)
  it('announces files that were set aside', async () => {
    await renderApp('/', { project: null, library: { invalid: ['library.json.invalid-2026'] } });
    expect(await screen.findByText(/library.json.invalid-2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/library.json.invalid-2026/)).not.toBeInTheDocument();
  });
});

describe('library export and import', () => {
  // protects=AC 17 export then import; fails_when=the exported .epl does not hold library.json, the catalogs and the logo, or importing it into an empty library does not restore company, logo and catalogs; no_claim=the files on disk (main tests)
  it('exports the library and restores it on an empty one', async () => {
    const source = await renderApp('/library/company', {
      project: null,
      library: { library: filled(), logo: { mimeType: 'image/png', bytes: png } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Export library…' }));
    await waitFor(() => expect(source.fileAccess.exports).toEqual(['library.epl']));
    const bytes = source.fileAccess.files.get('library.epl')!;
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual([
      'catalogs/c1.json',
      'library.json',
      'logo.png',
    ]);
    expect(strFromU8(unzipSync(bytes)['library.json']!)).toContain('Rossi');
    source.unmount();

    const fresh = await renderApp('/library/company', { project: null });
    await userEvent.upload(
      await screen.findByTestId('library-file'),
      new File([bytes as Uint8Array<ArrayBuffer>], 'library.epl'),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('1 catalog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace library' }));
    await waitFor(() =>
      expect(fresh.library.getState().library.company.businessName).toBe('Rossi'),
    );
    expect(fresh.library.getState().library.catalogs.map((c) => c.id)).toEqual(['c1']);
    expect([...fresh.library.getState().logo!.bytes]).toEqual([...png]);
    expect(fresh.libraryRepository.writes).toEqual(['replace']);
    expect(await screen.findByLabelText('Business name')).toHaveValue('Rossi');
  });

  // protects=AC 17 invalid .epl refused, library unchanged; fails_when=a damaged or foreign file replaces anything, asks for the replace confirmation, or the existing library changes; no_claim=the wording of each error
  it('refuses an invalid file and keeps the library', async () => {
    const app = await renderApp('/library/company', {
      project: null,
      library: { library: filled() },
    });
    await userEvent.upload(
      await screen.findByTestId('library-file'),
      new File(['not a zip'], 'x.epl'),
    );
    expect(await screen.findByText('This is not a library file.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(app.libraryRepository.writes).toEqual([]);
    expect(app.library.getState().library.company.businessName).toBe('Rossi');

    // Cancelling the confirmation changes nothing either.
    const good = writeEpl({ library: defaultLibrary(), logo: null }, new Date());
    await userEvent.upload(
      screen.getByTestId('library-file'),
      new File([good as Uint8Array<ArrayBuffer>], 'good.epl'),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(app.libraryRepository.writes).toEqual([]);
    expect(app.library.getState().library.company.businessName).toBe('Rossi');
  });
});
