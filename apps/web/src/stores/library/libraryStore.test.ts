import { describe, expect, it } from 'vitest';
import { defaultLibrary, type Library } from '@epd/domain/library';
import { createMemoryLibraryRepository } from '@/lib/repositories/library';
import { createLibraryStore } from './libraryStore';

const catalog = (id: string) => ({
  id,
  name: id,
  importedAt: '2026-10-26T10:00:00.000Z',
  items: [],
});
const seeded = (): Library => ({ ...defaultLibrary(), catalogs: [catalog('a'), catalog('b')] });
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('library store', () => {
  // protects=AC 10 write-through, one file per change; fails_when=a change is not written, rewrites an untouched part, or the store is not loaded from the repository before it is returned; no_claim=undo (the library has none)
  it('writes only the parts a change touches', async () => {
    const repo = createMemoryLibraryRepository({ library: seeded() });
    const store = await createLibraryStore(repo);
    expect(store.getState().library.catalogs.map((c) => c.id)).toEqual(['a', 'b']);

    store.getState().apply((d) => {
      d.company.businessName = 'Rossi';
    });
    store.getState().apply((d) => {
      d.catalogs[1]!.name = 'B2';
    });
    store.getState().apply((d) => {
      d.catalogs = d.catalogs.filter((c) => c.id !== 'a');
    });
    store.getState().apply(() => undefined);
    await settled();
    expect(repo.writes).toEqual(['core', 'catalog:b', 'remove:a']);
    expect(repo.data.library.company.businessName).toBe('Rossi');
    expect(repo.data.library.catalogs).toEqual([{ ...catalog('b'), name: 'B2' }]);
  });

  // protects=a failed write is visible; fails_when=a failing disk is swallowed (no writeError), or the change vanishes from the screen; no_claim=retrying
  it('keeps the change and reports a failed write', async () => {
    const repo = createMemoryLibraryRepository();
    const store = await createLibraryStore(repo);
    repo.failWrites = 'disk full';
    store.getState().apply((d) => {
      d.company.vatNumber = 'IT1';
    });
    await settled();
    expect(store.getState().library.company.vatNumber).toBe('IT1');
    expect(store.getState().writeError).toBe('disk full');
    store.getState().dismissWriteError();
    expect(store.getState().writeError).toBeNull();
  });

  // protects=logo is a separate file; fails_when=setting the logo rewrites library.json, or replaceAll changes the store before the repository accepted the library; no_claim=the backup folder (main tests)
  it('writes the logo apart and replaces the library as a whole', async () => {
    const repo = createMemoryLibraryRepository({ library: seeded() });
    const store = await createLibraryStore(repo);
    const logo = {
      mimeType: 'image/png' as const,
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    };
    store.getState().setLogo(logo);
    await settled();
    expect(repo.writes).toEqual(['logo']);

    repo.failWrites = 'locked';
    await expect(
      store.getState().replaceAll({ library: defaultLibrary(), logo: null }),
    ).rejects.toThrow('locked');
    expect(store.getState().library.catalogs).toHaveLength(2);
    repo.failWrites = null;
    await store.getState().replaceAll({ library: defaultLibrary(), logo: null });
    expect(store.getState().library).toEqual(defaultLibrary());
    expect(store.getState().logo).toBeNull();
  });

  // protects=AC 10 notice for invalid files; fails_when=files set aside at start are not listed in the state, or cannot be dismissed; no_claim=the notice text
  it('lists files set aside at start until dismissed', async () => {
    const repo = createMemoryLibraryRepository({ invalid: ['library.json.invalid-1'] });
    const store = await createLibraryStore(repo);
    expect(store.getState().invalid).toEqual(['library.json.invalid-1']);
    store.getState().dismissInvalid();
    expect(store.getState().invalid).toEqual([]);
  });
});
