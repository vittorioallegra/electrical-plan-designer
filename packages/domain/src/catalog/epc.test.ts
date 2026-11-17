import { describe, expect, it } from 'vitest';
import v1 from './fixtures/v1.epc.json';
import { CatalogFileError, EPC_SCHEMA_VERSION, parseEpc, toEpc } from './epc';
import { createProjectCatalog } from './replace';

describe('.epc catalog files', () => {
  // protects=.epc round trip; fails_when=exporting and importing a catalog changes its items, or exports ids, edit marks or items a replace left as missing; no_claim=CSV import
  it('exports a catalog and reads it back', () => {
    const catalog = createProjectCatalog(
      {
        name: 'Vimar 2026',
        items: [
          {
            category: 'device',
            name: 'Socket',
            code: 'S1',
            unitPrice: 520,
            unit: 'pcs',
            modules: 1,
            attributes: { deviceType: 'socket' },
          },
          { category: 'plate', name: 'Plate', code: 'P1', unit: 'pcs', attributes: {} },
        ],
      },
      new Date('2026-10-26'),
    );
    catalog.items[0]!.editedAt = '2026-10-27';
    catalog.items[1]!.missing = true;
    const file = JSON.parse(JSON.stringify(toEpc(catalog)));
    expect(file).toEqual({
      format: 'epc',
      schemaVersion: EPC_SCHEMA_VERSION,
      name: 'Vimar 2026',
      items: [
        {
          category: 'device',
          name: 'Socket',
          code: 'S1',
          unitPrice: 520,
          unit: 'pcs',
          modules: 1,
          attributes: { deviceType: 'socket' },
        },
      ],
    });
    expect(parseEpc(file, 'vimar.epc')).toEqual({
      name: 'Vimar 2026',
      source: 'vimar.epc',
      items: file.items,
    });
  });

  // protects=old .epc files always import (frozen v1 fixture); fails_when=a schema change refuses a version 1 file or changes its items; no_claim=—
  it('reads the frozen v1 fixture', () => {
    expect(parseEpc(structuredClone(v1), 'v1.epc')).toEqual({
      name: v1.name,
      source: 'v1.epc',
      items: v1.items,
    });
  });

  // protects=bad .epc files; fails_when=a non-catalog, newer or broken file is accepted; no_claim=—
  it('refuses files it cannot read', () => {
    const code = (json: unknown) => {
      try {
        parseEpc(json);
      } catch (e) {
        return e instanceof CatalogFileError ? e.code : 'other';
      }
      return 'ok';
    };
    expect(code({ format: 'epd' })).toBe('not_a_catalog');
    expect(
      code({ format: 'epc', schemaVersion: EPC_SCHEMA_VERSION + 1, name: 'x', items: [] }),
    ).toBe('newer_version');
    expect(code({ format: 'epc', schemaVersion: 1, name: 'x', items: [{ name: 1 }] })).toBe(
      'invalid',
    );
  });
});
