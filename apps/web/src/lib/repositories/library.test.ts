import { describe, expect, it } from 'vitest';
import type { EpdBridge } from '@epd/bridge/bridge';
import { defaultLibrary, libraryCoreOf, type Library } from '@epd/domain/library';
import { createDesktopLibraryRepository, createMemoryLibraryRepository } from './library';

const catalog = (id: string) => ({
  id,
  name: id,
  importedAt: '2026-10-26T10:00:00.000Z',
  items: [],
});
const logo = { mimeType: 'image/png' as const, bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) };

describe('memory library repository', () => {
  // protects=the fake behaves like the files; fails_when=a saved core, catalog, removal or logo is not read back by load(), writes are not logged one per part, or load() returns the stored object itself; no_claim=the files of the desktop app (main tests)
  it('stores each part and loads copies', async () => {
    const repo = createMemoryLibraryRepository();
    expect((await repo.load()).library).toEqual(defaultLibrary());

    const core = {
      ...libraryCoreOf(defaultLibrary()),
      company: { ...defaultLibrary().company, businessName: 'Rossi' },
    };
    await repo.saveCore(core);
    await repo.saveCatalog(catalog('a'));
    await repo.saveCatalog(catalog('b'));
    await repo.saveCatalog({ ...catalog('a'), name: 'A2' });
    await repo.removeCatalog('b');
    await repo.setLogo(logo);

    const loaded = await repo.load();
    expect(loaded.library).toEqual({ ...core, catalogs: [{ ...catalog('a'), name: 'A2' }] });
    expect(loaded.logo).toEqual(logo);
    expect(repo.writes).toEqual([
      'core',
      'catalog:a',
      'catalog:b',
      'catalog:a',
      'remove:b',
      'logo',
    ]);

    loaded.library.company.businessName = 'changed';
    expect(repo.data.library.company.businessName).toBe('Rossi');
  });

  // protects=seeding for tests and browser E2E; fails_when=a seeded library or its notice list is not what load() returns, or replace() drops the old library instead of keeping it as a backup; no_claim=the .epl format
  it('can be seeded and replaced with a backup', async () => {
    const seeded: Library = { ...defaultLibrary(), catalogs: [catalog('a')] };
    const repo = createMemoryLibraryRepository({
      library: seeded,
      invalid: ['library.json.invalid-x'],
    });
    expect(await repo.load()).toEqual({
      library: seeded,
      logo: null,
      invalid: ['library.json.invalid-x'],
    });
    await repo.replace({ library: defaultLibrary(), logo });
    expect(repo.backups).toEqual([{ library: seeded, logo: null }]);
    expect(repo.data).toEqual({ library: defaultLibrary(), logo });
  });
});

describe('desktop library repository', () => {
  const bridge = (library: unknown): EpdBridge['library'] =>
    ({
      load: async () => ({ library, logo: null, invalid: [] }),
    }) as unknown as EpdBridge['library'];

  // protects=a library main hands over is validated again; fails_when=a snapshot that does not match the schema is used instead of falling back to defaults with a notice; no_claim=main's own validation (main tests)
  it('falls back to defaults when the snapshot is invalid', async () => {
    const ok = await createDesktopLibraryRepository(bridge(defaultLibrary())).load();
    expect(ok).toEqual({ library: defaultLibrary(), logo: null, invalid: [] });
    const broken = await createDesktopLibraryRepository(bridge({ schemaVersion: 1 })).load();
    expect(broken.library).toEqual(defaultLibrary());
    expect(broken.invalid).toEqual(['library.json']);
  });
});
