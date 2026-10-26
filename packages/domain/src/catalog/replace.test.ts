import { describe, expect, it } from 'vitest';
import { ac4Doc } from '../testing/builders';
import { createCatalogLookup, projectCatalogItems } from './lookup';
import {
  createProjectCatalog,
  diffCatalogReplacement,
  replaceCatalog,
  usedItemIds,
  type IncomingItem,
} from './replace';
import { projectCatalogSchema } from './schema';
import { isBuiltin, type ProjectCatalog } from './types';

const now = new Date('2026-10-26T10:00:00.000Z');
const later = new Date('2027-03-01T10:00:00.000Z');

function seq(prefix = 'g'): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

const socket = (unitPrice: number): IncomingItem => ({
  category: 'device',
  name: 'Socket',
  code: 'S1',
  unitPrice,
  unit: 'pcs',
  modules: 1,
  attributes: { deviceType: 'socket' },
});
const plate: IncomingItem = {
  category: 'plate',
  name: 'Plate',
  code: 'P1',
  unitPrice: 300,
  unit: 'pcs',
  attributes: {},
};
const noCode: IncomingItem = { category: 'box', name: 'Box', unit: 'pcs', attributes: {} };

function vimar(): ProjectCatalog {
  return createProjectCatalog(
    { name: 'Vimar 2026', source: 'vimar.csv', items: [socket(450), plate, noCode] },
    now,
    seq(),
  );
}

describe('project catalogs', () => {
  // protects=imported item ids; fails_when=ids are not `<catalogId>:<code>`, collide on repeated codes or the catalog fails its schema; no_claim=CSV parsing
  it('creates a catalog with ids from codes', () => {
    const catalog = createProjectCatalog(
      { name: 'X', items: [socket(1), socket(2), noCode] },
      now,
      seq(),
    );
    expect(catalog.id).toBe('g1');
    expect(catalog.items.map((i) => i.id)).toEqual(['g1:S1', 'g1:g2', 'g1:g3']);
    expect(catalog.importedAt).toBe(now.toISOString());
    expect(projectCatalogSchema.safeParse(catalog).success).toBe(true);
  });

  // protects=catalog merge; fails_when=the lookup misses built-ins or imported items, or treats imported items as built-in; no_claim=archived filtering
  it('looks up built-ins and every project catalog', () => {
    const a = vimar();
    const b = createProjectCatalog({ name: 'B', items: [plate] }, now, seq('b'));
    const lookup = createCatalogLookup(projectCatalogItems([a, b]));
    expect(lookup('builtin:box_503')?.category).toBe('box');
    expect(lookup('g1:S1')?.unitPrice).toBe(450);
    expect(lookup('b1:P1')?.name).toBe('Plate');
    expect(isBuiltin(lookup('builtin:box_503')!)).toBe(true);
    expect(isBuiltin(lookup('b1:P1')!)).toBe(false);
  });

  // protects=used ids for the replace diff; fails_when=a box, content, conduit, enclosure, panel device or preset reference is missed; no_claim=cable lines (priced by section)
  it('collects the item ids a project uses', () => {
    const doc = ac4Doc();
    doc.panels[0]!.enclosureItemId = 'enc';
    const used = usedItemIds(doc, [
      { id: 'p', name: 'p', boxItemId: 'pb', contents: [{ itemId: 'pc', qty: 1 }] },
    ]);
    for (const id of [
      'enc',
      'pb',
      'pc',
      doc.segments[0]!.conduitItemId,
      doc.panels[0]!.devices[0]!.itemId,
    ])
      expect(used.has(id), id).toBe(true);
  });
});

describe('replacing a catalog', () => {
  // protects=replace diff; fails_when=price changes, new items, missing items in use or edit conflicts are misreported; no_claim=UI
  it('diffs by code', () => {
    const current = vimar();
    current.items[1]!.editedAt = now.toISOString();
    const incoming = [socket(500), { ...plate, name: 'Plate white' }, { ...plate, code: 'P2' }];
    const diff = diffCatalogReplacement(current, incoming, new Set(['g1:g2']));
    expect(diff.changed).toEqual([
      expect.objectContaining({
        before: current.items[0],
        priceChanged: true,
        editConflict: false,
      }),
      expect.objectContaining({
        before: current.items[1],
        priceChanged: false,
        editConflict: true,
      }),
    ]);
    expect(diff.unchanged).toEqual([]);
    expect(diff.added).toEqual([incoming[2]]);
    expect(diff.missing).toEqual([{ item: current.items[2], inUse: true }]);

    const same = diffCatalogReplacement(current, [socket(450)], new Set());
    expect(same.unchanged).toHaveLength(1);
    expect(same.missing.map((m) => m.inUse)).toEqual([false, false]);
  });

  // protects=AC 17b drawing keeps its items; fails_when=a matched item changes id, a missing item in use is dropped or unmarked, or an unused missing item stays; no_claim=check 10
  it('keeps ids of matched items and keeps missing items in use', () => {
    const current = vimar();
    const next = replaceCatalog(
      current,
      {
        name: 'Vimar 2027',
        source: 'vimar-2027.csv',
        items: [socket(500), { ...plate, code: 'P2' }],
      },
      new Set(['g1:g2']),
      {},
      later,
      seq('n'),
    );
    expect(next).toMatchObject({
      id: 'g1',
      name: 'Vimar 2027',
      source: 'vimar-2027.csv',
      importedAt: later.toISOString(),
    });
    expect(next.items.map((i) => [i.id, i.unitPrice, i.missing])).toEqual([
      ['g1:S1', 500, undefined],
      ['g1:P2', 300, undefined],
      ['g1:g2', undefined, true],
    ]);
    expect(projectCatalogSchema.safeParse(next).success).toBe(true);
    const lookup = createCatalogLookup(next.items);
    expect(lookup('g1:S1')?.unitPrice).toBe(500);
    expect(lookup('g1:P1')).toBeUndefined();
  });

  // protects=hand edits; fails_when=a kept edit is overwritten or an unkept one survives; no_claim=which fields count as an edit
  it('keeps or overwrites hand-edited items as chosen', () => {
    const current = vimar();
    current.items[0] = { ...current.items[0]!, unitPrice: 999, editedAt: now.toISOString() };
    const incoming = { name: 'V', items: [socket(500)] };
    const kept = replaceCatalog(
      current,
      incoming,
      new Set(),
      { keepEdited: new Set(['g1:S1']) },
      later,
    );
    expect(kept.items[0]).toMatchObject({
      id: 'g1:S1',
      unitPrice: 999,
      editedAt: now.toISOString(),
    });
    const overwritten = replaceCatalog(current, incoming, new Set(), {}, later);
    expect(overwritten.items[0]).toEqual({ ...socket(500), id: 'g1:S1' });
  });

  // protects=a previously missing item that comes back; fails_when=it stays marked missing after reappearing in a newer list; no_claim=diff wording
  it('clears the missing mark when the item comes back', () => {
    const current = vimar();
    current.items[0] = { ...current.items[0]!, missing: true };
    const next = replaceCatalog(current, { name: 'V', items: [socket(450)] }, new Set(), {}, later);
    expect(next.items[0]!.missing).toBeUndefined();
  });
});
