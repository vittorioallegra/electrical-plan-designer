import { describe, expect, it } from 'vitest';
import { computeBom } from '../bom';
import { defaultProjectSettings, defaultQuoteSettings } from '../defaults';
import { defaultLibrary, type Library } from '../library';
import { computeQuote } from '../quote';
import { ac4Doc, extraRun } from '../testing/builders';
import type { CablePrices } from '../types';
import { builtinById } from './builtin';
import {
  cableKeysOf,
  copyUsedItems,
  createLibrarySource,
  referencedItemIds,
  referenceSignature,
  setProjectPrice,
  type LibrarySource,
} from './copies';
import { createCatalogLookup } from './lookup';
import type { CatalogItem } from './types';

const brandSocket: CatalogItem = {
  id: 'c1:BR-1',
  category: 'device',
  name: 'Brand socket',
  code: 'BR-1',
  unitPrice: 450,
  unit: 'pcs',
  modules: 1,
  attributes: { deviceType: 'socket' },
};

function libraryWith(patch: Partial<Library> = {}): Library {
  return {
    ...defaultLibrary(),
    catalogs: [{ id: 'c1', name: 'Brand', importedAt: '2026-10-01', items: [brandSocket] }],
    ...patch,
  };
}

function project(doc = ac4Doc()) {
  return { doc, items: [] as CatalogItem[], cablePrices: {} as CablePrices };
}

describe('referenced items', () => {
  // protects=the set of items a project copies; fails_when=boxes, contents, conduits, panel devices or enclosures are missed or an unused id is added; no_claim=cables
  it('lists every item the drawing points at', () => {
    const ids = referencedItemIds(ac4Doc());
    expect([...ids].sort()).toEqual(
      [
        'builtin:blanking_cover',
        'builtin:box_503',
        'builtin:conduit_20',
        'builtin:enclosure_12m',
        'builtin:junction_box_92x92',
        'builtin:mcb_1pn_c10',
        'builtin:mcb_1pn_c16',
        'builtin:plate_3m',
        'builtin:rcd_2p_40a_30ma_a',
        'builtin:socket_10_16',
      ].sort(),
    );
  });

  // protects=cable keys come from the circuits' specs; fails_when=a circuit or extra-run conductor is missed or the key differs from the BOM's; no_claim=routing
  it('derives cable keys from circuits and extra runs, matching the BOM keys', () => {
    const doc = ac4Doc();
    doc.extraRuns.push(extraRun('x1', 'S', 'JB'));
    const keys = [...cableKeysOf(doc).keys()];
    expect(keys).toEqual(
      expect.arrayContaining([
        'cable:2.5:brown',
        'cable:2.5:blue',
        'cable:2.5:yellow_green',
        'cable:1.5:black',
        'cable:1.5:grey',
      ]),
    );
    const bomKeys = computeBom(doc, defaultProjectSettings(), createCatalogLookup())
      .filter((l) => l.cable)
      .map((l) => l.key);
    for (const key of bomKeys) expect(keys).toContain(key);
  });
});

describe('reference signature', () => {
  // protects=when copies are synced; fails_when=the signature ignores an item or a cable, or changes with order, or with edits that do not change what is referenced; no_claim=copying
  it('changes with what the drawing refers to only', () => {
    const doc = ac4Doc();
    const before = referenceSignature(doc);
    doc.nodes[2]!.contents!.reverse();
    doc.nodes[2]!.label = 'renamed';
    expect(referenceSignature(doc)).toBe(before);
    doc.nodes[2]!.contents!.push({ itemId: 'builtin:switch', qty: 1 });
    expect(referenceSignature(doc)).not.toBe(before);
    const other = ac4Doc();
    other.circuits[0]!.crossSection = 4;
    expect(referenceSignature(other)).not.toBe(before);
  });
});

describe('library source', () => {
  // protects=the price a copy gets; fails_when=an override does not price a built-in, an imported item's own price loses to an override, or a cable rule differs from the old lookup; no_claim=the library UI
  it('applies library prices the way the quote used to', () => {
    const source = createLibrarySource(
      libraryWith({
        priceOverrides: {
          'builtin:box_503': { unitPrice: 120, code: 'B503' },
          'c1:BR-1': { unitPrice: 999 },
          'cable:2.5:brown': { unitPrice: 55 },
          'builtin:cable_h07vk_2_5': { unitPrice: 40 },
        },
      }),
    );
    expect(source.item('builtin:box_503')).toMatchObject({ unitPrice: 120, code: 'B503' });
    expect(source.item('builtin:nope')).toBeUndefined();
    expect(source.item('builtin:socket_10_16')).toEqual(builtinById.get('builtin:socket_10_16'));
    expect(source.item('c1:BR-1')?.unitPrice).toBe(450);
    expect(source.cablePrice(2.5, 'brown')).toEqual({ unitPrice: 55 });
    expect(source.cablePrice(2.5, 'blue')).toEqual({ unitPrice: 40 });
    expect(source.cablePrice(1.5, 'blue')).toBeUndefined();
  });

  // protects=cable items price cable lines; fails_when=a priced library cable item of the same section and color is ignored; no_claim=archived items
  it('prices a cable from a matching library cable item first', () => {
    const cable: CatalogItem = {
      id: 'c1:CAB',
      category: 'cable',
      name: 'Brown 2.5',
      code: 'CAB',
      unitPrice: 60,
      unit: 'm',
      attributes: { crossSection: 2.5, color: 'brown' },
    };
    const source = createLibrarySource(
      libraryWith({
        catalogs: [{ id: 'c1', name: 'Brand', importedAt: '2026-10-01', items: [cable] }],
        priceOverrides: { 'cable:2.5:brown': { unitPrice: 55 } },
      }),
    );
    expect(source.cablePrice(2.5, 'brown')).toEqual({ unitPrice: 60, code: 'CAB' });
  });
});

describe('copyUsedItems', () => {
  // protects=AC 11 copies of what the project uses; fails_when=an item or cable price is not copied with the library price applied, or an unrelated item is; no_claim=undo
  it('copies every used item and cable price and nothing else', () => {
    const doc = ac4Doc();
    doc.nodes[2]!.contents!.push({ itemId: 'c1:BR-1', qty: 1 });
    const p = project(doc);
    copyUsedItems(
      p,
      createLibrarySource(
        libraryWith({
          priceOverrides: {
            'builtin:box_503': { unitPrice: 120 },
            'cable:2.5:brown': { unitPrice: 55 },
          },
        }),
      ),
    );
    expect(new Set(p.items.map((i) => i.id))).toEqual(referencedItemIds(doc));
    expect(p.items.find((i) => i.id === 'builtin:box_503')?.unitPrice).toBe(120);
    expect(p.items.find((i) => i.id === 'c1:BR-1')).toEqual(brandSocket);
    expect(p.cablePrices).toEqual({ 'cable:2.5:brown': { unitPrice: 55 } });
  });

  // protects=copies follow the drawing; fails_when=an unused copy or cable price stays, or a new reference is not copied; no_claim=undo
  it('drops copies nothing uses any more and adds new ones', () => {
    const p = project();
    const source = createLibrarySource(libraryWith({ priceOverrides: {} }));
    copyUsedItems(p, source);
    p.items.push({ ...brandSocket });
    p.cablePrices['cable:6:red'] = { unitPrice: 1 };
    copyUsedItems(p, source);
    expect(p.items.some((i) => i.id === 'c1:BR-1')).toBe(false);
    expect(p.cablePrices['cable:6:red']).toBeUndefined();
    p.doc.nodes[2]!.contents!.push({ itemId: 'c1:BR-1', qty: 1 });
    copyUsedItems(p, source);
    expect(p.items.some((i) => i.id === 'c1:BR-1')).toBe(true);
  });

  // protects=prices stay with the project; fails_when=a library change, or a later command, overwrites an existing copy or cable price, or an unchanged set touches the project; no_claim=update from library
  it('never overwrites a copy and does not read items again when the referenced set is unchanged', () => {
    const p = project();
    copyUsedItems(
      p,
      createLibrarySource(
        libraryWith({
          priceOverrides: {
            'builtin:box_503': { unitPrice: 120 },
            'cable:2.5:brown': { unitPrice: 55 },
          },
        }),
      ),
    );
    const before = structuredClone(p);
    const itemsRef = p.items;
    const failing: LibrarySource = {
      item: () => {
        throw new Error('library read');
      },
      cablePrice: () => undefined,
    };
    copyUsedItems(p, failing);
    expect(p).toEqual(before);
    expect(p.items).toBe(itemsRef);
    copyUsedItems(
      p,
      createLibrarySource(
        libraryWith({
          priceOverrides: {
            'builtin:box_503': { unitPrice: 999 },
            'cable:2.5:brown': { unitPrice: 1 },
          },
        }),
      ),
    );
    expect(p).toEqual(before);
  });

  // protects=an id the library does not have; fails_when=an unknown item is copied as something or the call throws; no_claim=check 10
  it('leaves an item the library does not have out of the copies', () => {
    const doc = ac4Doc();
    doc.nodes[2]!.contents!.push({ itemId: 'gone:X', qty: 1 });
    const p = project(doc);
    copyUsedItems(p, createLibrarySource(libraryWith()));
    expect(p.items.some((i) => i.id === 'gone:X')).toBe(false);
  });
});

describe('a project with its own copies', () => {
  // protects=AC 12/13 BOM and quote independent of the library and the built-ins; fails_when=totals change with an empty library or after a library or built-in price change; no_claim=update from library
  it('prices the same from its copies whatever the library holds', () => {
    const doc = ac4Doc();
    const p = project(doc);
    const withPrices = libraryWith({
      priceOverrides: {
        'builtin:box_503': { unitPrice: 120 },
        'builtin:conduit_20': { unitPrice: 80 },
        'builtin:cable_h07vk_2_5': { unitPrice: 40 },
      },
    });
    copyUsedItems(p, createLibrarySource(withPrices));
    const totals = () => {
      const catalog = createCatalogLookup(p.items);
      const bom = computeBom(doc, defaultProjectSettings(), catalog);
      return computeQuote(
        bom,
        { catalog, cablePrices: p.cablePrices },
        defaultQuoteSettings(),
        (l) => l.key,
      ).totals;
    };
    const saved = totals();
    expect(saved.materialsBeforeAdjustment).toBeGreaterThan(0);
    // The library is emptied and a price changes later: the project does not care.
    copyUsedItems(p, createLibrarySource(defaultLibrary()));
    copyUsedItems(
      p,
      createLibrarySource(libraryWith({ priceOverrides: { 'builtin:box_503': { unitPrice: 1 } } })),
    );
    expect(totals()).toEqual(saved);
  });

  // protects=a built-in change does not reprice an old project; fails_when=the built-in item wins over the project's copy in the lookup; no_claim=UI
  it('the copy wins over the built-in of the same id', () => {
    const copy: CatalogItem = {
      ...builtinById.get('builtin:box_503')!,
      unitPrice: 120,
      modules: 9,
    };
    expect(createCatalogLookup([copy])('builtin:box_503')).toBe(copy);
    expect(createCatalogLookup()('builtin:box_503')?.unitPrice).toBeUndefined();
  });
});

describe('setProjectPrice', () => {
  // protects=quote price edits stay in the project; fails_when=a typed price lands anywhere but the item copy, a new built-in copy or the cable price, or an unknown line is invented; no_claim=undo
  it('prices an item copy, a built-in without a copy, or a cable line', () => {
    const p = project();
    expect(setProjectPrice(p, 'builtin:box_503', 150)).toBe(true);
    expect(p.items).toEqual([{ ...builtinById.get('builtin:box_503'), unitPrice: 150 }]);
    expect(setProjectPrice(p, 'builtin:box_503', 200)).toBe(true);
    expect(p.items).toHaveLength(1);
    expect(p.items[0]!.unitPrice).toBe(200);
    expect(setProjectPrice(p, 'cable:2.5:brown', 55)).toBe(true);
    expect(setProjectPrice(p, 'cable:2.5:brown', 60)).toBe(true);
    expect(p.cablePrices).toEqual({ 'cable:2.5:brown': { unitPrice: 60 } });
    expect(setProjectPrice(p, 'gone:X', 1)).toBe(false);
    expect(p.items).toHaveLength(1);
  });
});
