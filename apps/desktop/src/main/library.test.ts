import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultLibrary, libraryCoreOf, type Library } from '@epd/domain/library';
import * as nodeFs from 'node:fs/promises';
import { createLibraryService, type LibraryFsOps } from './library';

let root: string;
let dir: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'epd-library-'));
  dir = join(root, 'library');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 9]);

const catalog = (id: string, importedAt = '2026-10-26T10:00:00.000Z') => ({
  id,
  name: `Catalog ${id}`,
  importedAt,
  items: [
    {
      id: `${id}:V1`,
      category: 'device' as const,
      name: 'Socket',
      code: 'V1',
      unitPrice: 520,
      unit: 'pcs' as const,
      attributes: { deviceType: 'socket' as const },
    },
  ],
});

function filled(): Library {
  return {
    ...defaultLibrary(),
    company: {
      businessName: 'Rossi',
      vatNumber: 'IT1',
      address: 'Via Roma',
      phone: '1',
      email: 'a@b.c',
    },
    catalogs: [catalog('c1'), catalog('c2', '2026-10-27T10:00:00.000Z')],
    priceOverrides: { 'builtin:socket_schuko': { unitPrice: 390 } },
  };
}

const service = (now = () => new Date('2026-11-01T08:00:00.000Z')) =>
  createLibraryService({ dir, now });
const names = (path: string) => readdirSync(path).sort();

describe('library storage', () => {
  // protects=AC 10 first run; fails_when=a fresh install does not start with the default library, or reports invalid files; no_claim=the renderer
  it('starts with defaults when nothing is stored', async () => {
    const loaded = await service().load();
    expect(loaded).toEqual({ library: defaultLibrary(), logo: null, invalid: [] });
  });

  // protects=AC 10 persistence and one file per change; fails_when=a saved part does not load back, a change rewrites other files, or the files are not library.json, catalogs/<id>.json and logo.<ext>; no_claim=restart of the app (Electron E2E)
  it('stores each part in its own file and loads it back', async () => {
    const library = filled();
    const files = service();
    await files.saveCore(libraryCoreOf(library));
    for (const c of library.catalogs) await files.saveCatalog(c);
    await files.setLogo({ mimeType: 'image/png', bytes: png });
    expect(names(dir)).toEqual(['catalogs', 'library.json', 'logo.png']);
    expect(names(join(dir, 'catalogs'))).toEqual(['c1.json', 'c2.json']);

    const before = readFileSync(join(dir, 'library.json'), 'utf8');
    await files.saveCatalog({ ...library.catalogs[0]!, name: 'Renamed' });
    expect(readFileSync(join(dir, 'library.json'), 'utf8')).toBe(before);

    const loaded = await service().load();
    expect(loaded.invalid).toEqual([]);
    expect(loaded.logo).toEqual({ mimeType: 'image/png', bytes: png });
    expect(loaded.library).toEqual({
      ...library,
      catalogs: [{ ...library.catalogs[0]!, name: 'Renamed' }, library.catalogs[1]],
    });

    await files.removeCatalog('c1');
    await files.setLogo({ mimeType: 'image/jpeg', bytes: jpg });
    expect(names(join(dir, 'catalogs'))).toEqual(['c2.json']);
    expect(names(dir)).toEqual(['catalogs', 'library.json', 'logo.jpg']);
    await files.setLogo(null);
    expect(names(dir)).toEqual(['catalogs', 'library.json']);
  });

  // protects=invalid files are never overwritten; fails_when=a file failing validation is deleted, overwritten or loaded, the rest of the library is lost, or the notice list is empty; no_claim=the notice in the UI
  it('sets an invalid file aside and keeps the rest', async () => {
    const library = filled();
    const files = service();
    await files.saveCatalog(library.catalogs[0]!);
    await files.saveCatalog(library.catalogs[1]!);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'library.json'), '{"schemaVersion":1,"company":3}');
    writeFileSync(join(dir, 'catalogs', 'c2.json'), 'not json');
    writeFileSync(join(dir, 'logo.png'), jpg);

    const loaded = await service().load();
    const stamp = '2026-11-01T08-00-00-000Z';
    expect(loaded.invalid.sort()).toEqual([
      `c2.json.invalid-${stamp}`,
      `library.json.invalid-${stamp}`,
      `logo.png.invalid-${stamp}`,
    ]);
    expect(loaded.library).toEqual({ ...defaultLibrary(), catalogs: [library.catalogs[0]] });
    expect(loaded.logo).toBeNull();
    expect(readFileSync(join(dir, `library.json.invalid-${stamp}`), 'utf8')).toContain(
      '"company":3',
    );
    expect(names(join(dir, 'catalogs'))).toEqual(['c1.json', `c2.json.invalid-${stamp}`]);
    // A second start finds nothing more to complain about.
    expect((await service().load()).invalid).toEqual([]);
  });

  // protects=a catalog id is its file name; fails_when=a catalog whose id differs from its file name, or an id that is not a safe file name, is stored or loaded; no_claim=catalog contents
  it('refuses unsafe catalog ids and mismatched files', async () => {
    const files = service();
    await expect(files.saveCatalog(catalog('../evil'))).rejects.toThrow();
    await expect(files.removeCatalog('../evil')).rejects.toThrow();
    expect(names(root)).toEqual([]);
    mkdirSync(join(dir, 'catalogs'), { recursive: true });
    writeFileSync(join(dir, 'catalogs', 'other.json'), JSON.stringify(catalog('c1')));
    const loaded = await files.load();
    expect(loaded.library.catalogs).toEqual([]);
    expect(loaded.invalid).toHaveLength(1);
  });

  // protects=validation before writing; fails_when=an invalid core, catalog or logo reaches the disk; no_claim=schema rules (domain tests)
  it('validates what it is asked to write', async () => {
    const files = service();
    await expect(files.saveCore({ schemaVersion: 1 })).rejects.toThrow();
    await expect(files.saveCatalog({ id: 'c1' })).rejects.toThrow();
    await expect(files.setLogo({ mimeType: 'image/png', bytes: jpg })).rejects.toThrow();
    await expect(files.setLogo({ mimeType: 'image/gif', bytes: png } as never)).rejects.toThrow();
    expect(names(root)).toEqual([]);
  });

  // protects=AC 17 replace keeps a backup; fails_when=replacing loses the old files, leaves catalogs or logo of the old library behind, or an invalid library changes anything; no_claim=the confirmation in the UI
  it('replaces the library after copying the old one aside', async () => {
    const files = service();
    const old = filled();
    await files.saveCore(libraryCoreOf(old));
    for (const c of old.catalogs) await files.saveCatalog(c);
    await files.setLogo({ mimeType: 'image/png', bytes: png });

    await expect(
      files.replace({ library: { ...old, schemaVersion: 2 }, logo: null }),
    ).rejects.toThrow();
    expect(names(root)).toEqual(['library']);

    const next: Library = {
      ...defaultLibrary(),
      company: { ...old.company, businessName: 'Bianchi' },
      catalogs: [catalog('c3')],
    };
    await files.replace({ library: next, logo: { mimeType: 'image/jpeg', bytes: jpg } });

    const backup = 'library.backup-2026-11-01T08-00-00-000Z';
    expect(names(root)).toEqual(['library', backup]);
    expect(names(join(root, backup, 'catalogs'))).toEqual(['c1.json', 'c2.json']);
    expect(names(join(root, backup))).toContain('logo.png');
    expect(names(dir)).toEqual(['catalogs', 'library.json', 'logo.jpg']);
    expect(names(join(dir, 'catalogs'))).toEqual(['c3.json']);
    const loaded = await service().load();
    expect(loaded.library).toEqual(next);
    expect(loaded.logo).toEqual({ mimeType: 'image/jpeg', bytes: jpg });
  });

  // protects=replace is all-or-nothing on disk; fails_when=a disk error midway through an import leaves a mixed library, a staging folder behind, or no way back to the old library; no_claim=the in-memory store (renderer tests)
  it('keeps the old library intact when replacing fails midway', async () => {
    const old = filled();
    const files = service();
    await files.saveCore(libraryCoreOf(old));
    for (const c of old.catalogs) await files.saveCatalog(c);
    const next: Library = { ...defaultLibrary(), catalogs: [catalog('c3'), catalog('c4')] };

    // Fails while writing the second new catalog, then while swapping the new folder in.
    for (const failsOn of [
      (from: string, to: string) => to.endsWith('c4.json'),
      (from: string, to: string) =>
        from.endsWith('.staging-2026-11-01T08-00-00-000Z') && to === dir,
    ]) {
      const failing: LibraryFsOps = {
        ...nodeFs,
        rename: async (from, to) => {
          if (failsOn(String(from), String(to)))
            throw Object.assign(new Error('boom'), { code: 'EIO' });
          return nodeFs.rename(from, to);
        },
      };
      const broken = createLibraryService({
        dir,
        fs: failing,
        now: () => new Date('2026-11-01T08:00:00.000Z'),
      });
      await expect(broken.replace({ library: next, logo: null })).rejects.toThrow('boom');
      expect(names(root)).toEqual(['library']);
      expect((await service().load()).library).toEqual(old);
    }
  });
});
