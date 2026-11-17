import { describe, expect, it } from 'vitest';
import v1 from './library/fixtures/v1.json';
import {
  defaultLibrary,
  LIBRARY_SCHEMA_VERSION,
  libraryCoreOf,
  LibraryError,
  loadLibrary,
  loadLibraryCatalog,
  loadLibraryCore,
  matchesLogoType,
  type Library,
} from './library';
import { defaultProjectSettings, defaultQuoteSettings } from './defaults';

const catalog = (id: string) => ({
  id,
  name: 'Vimar 2026',
  importedAt: '2026-10-26T10:00:00.000Z',
  items: [
    {
      id: `${id}:V1`,
      category: 'device',
      name: 'Vimar socket',
      code: 'V1',
      unitPrice: 520,
      unit: 'pcs' as const,
      attributes: { deviceType: 'socket' },
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
      country: 'DE',
    },
    catalogs: [catalog('c1') as never],
    priceOverrides: { 'builtin:socket_schuko': { unitPrice: 390 } },
    boxPresets: [
      { id: 'p1', name: 'Kitchen', boxItemId: 'c1:V1', contents: [{ itemId: 'c1:V1', qty: 2 }] },
    ],
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

describe('library schema', () => {
  // protects=AC 10 defaults; fails_when=an empty library is not valid, or does not carry the app's default project and quote settings; no_claim=the stored files (main tests)
  it('has valid defaults', () => {
    const library = defaultLibrary();
    expect(loadLibrary(structuredClone(library))).toEqual(library);
    expect(library.defaults.settings).toEqual(defaultProjectSettings());
    expect(library.defaults.quote).toEqual(defaultQuoteSettings());
    expect(library.catalogs).toEqual([]);
  });

  // protects=AC 17 full round trip; fails_when=company, catalogs, prices, presets or defaults are lost or altered by a JSON round trip; no_claim=the .epl zip (web tests)
  it('keeps every section through JSON', () => {
    const library = filled();
    expect(loadLibrary(JSON.parse(JSON.stringify(library)))).toEqual(library);
  });

  // protects=typed load errors; fails_when=a newer version, a non-library or a broken section is accepted or reported with the wrong code; no_claim=message wording
  it('refuses with a typed error', () => {
    expect(codeOf(() => loadLibrary(null))).toBe('not_a_library');
    expect(codeOf(() => loadLibrary({ company: {} }))).toBe('not_a_library');
    expect(
      codeOf(() => loadLibrary({ ...filled(), schemaVersion: LIBRARY_SCHEMA_VERSION + 1 })),
    ).toBe('newer_version');
    expect(
      codeOf(() => loadLibrary({ ...filled(), priceOverrides: { a: { unitPrice: -1 } } })),
    ).toBe('invalid');
    expect(
      codeOf(() => loadLibrary({ ...filled(), defaults: { ...filled().defaults, quote: {} } })),
    ).toBe('invalid');
  });

  // protects=old libraries always open (frozen v1 fixture); fails_when=a schema change breaks loading a version 1 library, loses its data, or leaves the company without Italy as its country; no_claim=storage on disk (main tests)
  it('loads the frozen v1 fixture at the current version', () => {
    const library = loadLibrary(structuredClone(v1));
    expect(library.schemaVersion).toBe(LIBRARY_SCHEMA_VERSION);
    expect(library.company.country).toBe('IT');
    expect({
      ...library,
      schemaVersion: 1,
      company: { ...library.company, country: undefined },
    }).toEqual({ ...v1, company: { ...v1.company, country: undefined } });
    expect(loadLibraryCore(libraryCoreOf(structuredClone(v1) as never)).schemaVersion).toBe(
      LIBRARY_SCHEMA_VERSION,
    );
  });

  // protects=company country; fails_when=a version 2 library without a country (development builds) does not open with Italy, or a country outside the euro area is accepted; no_claim=VAT rates (vatRates tests)
  it('fills a missing country and refuses one outside the euro area', () => {
    const { country: _country, ...company } = filled().company;
    expect(loadLibrary({ ...filled(), company }).company.country).toBe('IT');
    expect(
      loadLibrary({ ...filled(), company: { ...company, country: 'other' } }).company.country,
    ).toBe('other');
    expect(codeOf(() => loadLibrary({ ...filled(), company: { ...company, country: 'US' } }))).toBe(
      'invalid',
    );
  });

  // protects=catalog integrity; fails_when=two catalogs with one id, or an item outside its catalog's id space, are accepted; no_claim=item attribute rules (catalog schema tests)
  it('refuses duplicate catalog ids and items outside their catalog', () => {
    const duplicate = { ...filled(), catalogs: [catalog('c1'), catalog('c1')] };
    expect(codeOf(() => loadLibrary(duplicate))).toBe('invalid');
    const stray = catalog('c1');
    stray.items[0]!.id = 'other:V1';
    expect(codeOf(() => loadLibraryCatalog(stray))).toBe('invalid');
  });

  // protects=files stored apart; fails_when=the core of a library is not valid on its own, or still holds the catalogs; no_claim=storage (main tests)
  it('splits into a core and catalogs', () => {
    const core = libraryCoreOf(filled());
    expect(core).not.toHaveProperty('catalogs');
    expect(loadLibraryCore(core)).toEqual(core);
    expect(loadLibraryCatalog(catalog('c1'))).toEqual(catalog('c1'));
  });

  // protects=logo files; fails_when=a file with the wrong magic bytes passes as a PNG or JPEG; no_claim=image decoding
  it('checks the logo type by its first bytes', () => {
    expect(matchesLogoType('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]))).toBe(true);
    expect(matchesLogoType('image/png', new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
    expect(matchesLogoType('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(matchesLogoType('image/jpeg', new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
