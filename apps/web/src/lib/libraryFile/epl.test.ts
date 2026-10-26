import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { defaultLibrary, LibraryError, type Library } from '@epd/domain/library';
import { readEpl, writeEpl } from './epl';

const now = new Date('2026-10-26T10:00:00.000Z');
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const catalog = (id: string, importedAt: string) => ({
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
    catalogs: [catalog('a', '2026-10-26T10:00:00.000Z'), catalog('b', '2026-10-27T10:00:00.000Z')],
    priceOverrides: { 'builtin:socket_schuko': { unitPrice: 390 } },
    boxPresets: [
      { id: 'p1', name: 'Kitchen', boxItemId: 'a:V1', contents: [{ itemId: 'a:V1', qty: 2 }] },
    ],
    defaults: {
      settings: { ...defaultLibrary().defaults.settings, wastePercent: 15 },
      quote: {
        materialAdjustmentPercent: 5,
        vatPercent: 10,
        laborLines: [{ kind: 'lump', description: 'Install', amount: 100 }],
      },
    },
  };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof LibraryError ? e.code : `other: ${String(e)}`;
  }
  return undefined;
}

describe('.epl files', () => {
  // protects=AC 17 export then import; fails_when=company, logo, catalogs, prices, presets or defaults differ after a write and read, or the zip lacks library.json, catalogs/<id>.json or logo.png; no_claim=the dialogs and the files in the app data folder
  it('round-trips the whole library', () => {
    const data = { library: filled(), logo: { mimeType: 'image/png' as const, bytes: png } };
    const bytes = writeEpl(data, now);
    expect(readEpl(bytes)).toEqual(data);
    const empty = { library: defaultLibrary(), logo: null };
    expect(readEpl(writeEpl(empty, now))).toEqual(empty);
  });

  // protects=AC 17 invalid .epl refused; fails_when=a non-zip, a zip without library.json, a newer version, an invalid section, a catalog file that disagrees with its id or a fake logo is accepted; no_claim=message wording
  it('refuses an invalid file', () => {
    const zip = (files: Record<string, string | Uint8Array>) =>
      zipSync(
        Object.fromEntries(
          Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]),
        ),
      );
    const { catalogs: _c, ...core } = filled();
    const json = (value: unknown) => JSON.stringify(value);
    const ok = { 'library.json': json(core), 'catalogs/a.json': json(filled().catalogs[0]) };

    expect(codeOf(() => readEpl(zip(ok)))).toBeUndefined();
    expect(codeOf(() => readEpl(strToU8('not a zip')))).toBe('not_a_library');
    expect(codeOf(() => readEpl(zip({ 'other.txt': 'x' })))).toBe('not_a_library');
    expect(codeOf(() => readEpl(zip({ ...ok, 'library.json': 'oops' })))).toBe('invalid');
    expect(
      codeOf(() => readEpl(zip({ ...ok, 'library.json': json({ ...core, schemaVersion: 2 }) }))),
    ).toBe('newer_version');
    expect(
      codeOf(() => readEpl(zip({ ...ok, 'library.json': json({ ...core, defaults: {} }) }))),
    ).toBe('invalid');
    expect(
      codeOf(() => readEpl(zip({ ...ok, 'catalogs/b.json': json(filled().catalogs[0]) }))),
    ).toBe('invalid');
    expect(codeOf(() => readEpl(zip({ ...ok, 'logo.png': new Uint8Array([1, 2, 3]) })))).toBe(
      'invalid',
    );
  });
});
