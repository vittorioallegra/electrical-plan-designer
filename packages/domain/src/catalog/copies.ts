// A project holds copies of the catalog items it uses and the prices of its cables, so it
// prices and prints the same on any machine, whatever the library or the built-in catalog say.
import { cableLineKey } from '../bom';
import type { Library } from '../library';
import type { CableColor, CablePrices, PriceOverrides, ProjectDoc } from '../types';
import { builtinById, builtinCableId } from './builtin';
import type { CatalogItem } from './types';
import { isBuiltin } from './types';

/** An item id the drawing uses, and the element that uses it. */
export interface ItemReference {
  itemId: string;
  ref:
    | { kind: 'node' | 'segment'; id: string }
    | { kind: 'panel_device'; id: string; panelId: string };
}

/** Every catalog item the drawing points at: boxes, contents, conduits, panel devices, enclosures. */
export function itemReferences(doc: ProjectDoc): ItemReference[] {
  const refs: ItemReference[] = [];
  for (const n of doc.nodes) {
    const ref = { kind: 'node' as const, id: n.id };
    if (n.boxItemId !== undefined) refs.push({ itemId: n.boxItemId, ref });
    for (const c of n.contents ?? []) refs.push({ itemId: c.itemId, ref });
  }
  for (const s of doc.segments) {
    refs.push({ itemId: s.conduitItemId, ref: { kind: 'segment', id: s.id } });
  }
  for (const panel of doc.panels) {
    if (panel.enclosureItemId !== undefined) {
      refs.push({ itemId: panel.enclosureItemId, ref: { kind: 'node', id: panel.nodeId } });
    }
    for (const d of panel.devices) {
      refs.push({ itemId: d.itemId, ref: { kind: 'panel_device', id: d.id, panelId: panel.id } });
    }
  }
  return refs;
}

export function referencedItemIds(doc: ProjectDoc): Set<string> {
  return new Set(itemReferences(doc).map((r) => r.itemId));
}

/** The BOM cable line keys the circuits and extra runs can produce, from their cable specs. */
export function cableKeysOf(
  doc: ProjectDoc,
): Map<string, { crossSection: number; color: CableColor }> {
  const keys = new Map<string, { crossSection: number; color: CableColor }>();
  const add = (crossSection: number, color: CableColor) =>
    keys.set(cableLineKey(crossSection, color), { crossSection, color });
  for (const c of doc.circuits) for (const w of c.conductors) add(c.crossSection, w.color);
  for (const run of doc.extraRuns) for (const w of run.conductors) add(w.crossSection, w.color);
  return keys;
}

/** What the drawing refers to, as one comparable string: item ids and cable line keys. */
export function referenceSignature(doc: ProjectDoc): string {
  return [...referencedItemIds(doc), ...cableKeysOf(doc).keys()].sort().join('|');
}

/** What the library gives a project: items with their price applied, and cable prices. */
export interface LibrarySource {
  item(id: string): CatalogItem | undefined;
  cablePrice(crossSection: number, color: CableColor): CablePrices[string] | undefined;
}

/**
 * The library as a source of copies. An item's price is its own (imported items) or the
 * library's override of its id (built-ins, and items without a price); a cable's price is the
 * matching library cable item, else the override of that cable line, else the override of the
 * built-in cable of its cross-section.
 */
export function createLibrarySource(
  library: Pick<Library, 'catalogs' | 'priceOverrides'>,
): LibrarySource {
  // Built on first use: most commands never need the library.
  let items: Map<string, CatalogItem> | undefined;
  const own = () =>
    (items ??= new Map(library.catalogs.flatMap((c) => c.items).map((i) => [i.id, i])));
  const overrides: PriceOverrides = library.priceOverrides;
  return {
    item(id) {
      const item = builtinById.get(id) ?? own().get(id);
      if (!item) return undefined;
      if (!isBuiltin(item) && item.unitPrice !== undefined) return item;
      const override = overrides[id];
      if (!override) return item;
      return { ...item, unitPrice: override.unitPrice, ...codeOf(override.code ?? item.code) };
    },
    cablePrice(crossSection, color) {
      const priced = [...own().values()].find(
        (i) =>
          i.category === 'cable' &&
          !i.archived &&
          i.unitPrice !== undefined &&
          i.attributes.crossSection === crossSection &&
          i.attributes.color === color,
      );
      if (priced) return { unitPrice: priced.unitPrice!, ...codeOf(priced.code) };
      const override =
        overrides[cableLineKey(crossSection, color)] ?? overrides[builtinCableId(crossSection)];
      return override ? { unitPrice: override.unitPrice, ...codeOf(override.code) } : undefined;
    },
  };
}

function codeOf(code: string | undefined): { code?: string } {
  return code ? { code } : {};
}

interface CopyTarget {
  doc: ProjectDoc;
  items: CatalogItem[];
  cablePrices: CablePrices;
}

/**
 * Brings the project's copies in line with its drawing: adds a copy of every referenced item
 * and a price for every cable it does not have yet (from `source`), and drops copies and prices
 * nothing refers to any more. Existing copies are never overwritten, so prices typed in the
 * project stay. Written to run inside a command's recipe on its draft (when
 * `referenceSignature` changed), so undo and redo restore the copies with the change.
 */
export function copyUsedItems(project: CopyTarget, source: LibrarySource): void {
  const wanted = referencedItemIds(project.doc);
  const have = new Set(project.items.map((i) => i.id));
  const stale = project.items.some((i) => !wanted.has(i.id));
  if (stale) {
    const kept = project.items.filter((i) => wanted.has(i.id));
    project.items.splice(0, project.items.length, ...kept);
  }
  for (const id of wanted) {
    if (have.has(id)) continue;
    const item = source.item(id);
    if (item) project.items.push(structuredClone(item));
  }

  const cables = cableKeysOf(project.doc);
  for (const key of Object.keys(project.cablePrices)) {
    if (!cables.has(key)) delete project.cablePrices[key];
  }
  for (const [key, spec] of cables) {
    if (project.cablePrices[key] !== undefined) continue;
    const price = source.cablePrice(spec.crossSection, spec.color);
    if (price) project.cablePrices[key] = { ...price };
  }
}

/**
 * Sets the price of a quote line in the project only: an item copy's `unitPrice` (a copy of the
 * built-in is made when there is none yet) or a cable price. False when the line is neither,
 * e.g. an item the project has no copy of and the app does not know.
 */
export function setProjectPrice(
  project: Pick<CopyTarget, 'items' | 'cablePrices'>,
  lineKey: string,
  unitPrice: number,
): boolean {
  if (lineKey.startsWith('cable:')) {
    project.cablePrices[lineKey] = { ...project.cablePrices[lineKey], unitPrice };
    return true;
  }
  const copy = project.items.find((i) => i.id === lineKey);
  if (copy) {
    copy.unitPrice = unitPrice;
    return true;
  }
  const builtin = builtinById.get(lineKey);
  if (!builtin) return false;
  project.items.push({ ...structuredClone(builtin), unitPrice });
  return true;
}

type CablePrice = CablePrices[string];

/** An item copy that differs from the library's item, or that the project has no copy of yet. */
export interface ItemUpdate {
  kind: 'item';
  /** The item id. */
  key: string;
  /** The project's copy; absent when the drawing uses the item but the project never copied it. */
  before?: CatalogItem;
  /** The library's item, with its price applied. */
  after: CatalogItem;
  priceChanged: boolean;
  /** Changed fields other than the price: `name`, `code`, `category`, `unit`, `modules`, `attributes.<key>`. */
  changedFields: string[];
}

/** A cable price that differs from the library's, or that the project does not have yet. */
export interface CableUpdate {
  kind: 'cable';
  /** The BOM cable key, `cable:<section>:<color>`. */
  key: string;
  crossSection: number;
  color: CableColor;
  /** The project's price; absent when it has none. */
  before?: CablePrice;
  /** The library's price; absent when the library prices no such cable. */
  after?: CablePrice;
}

export type CatalogUpdate = ItemUpdate | CableUpdate;

export interface CatalogUpdateDiff {
  /** What the library would change in the project, each applicable on its own. */
  updates: CatalogUpdate[];
  /** Item copies the library no longer has: they stay as they are. */
  missing: CatalogItem[];
}

function changedFieldsOf(before: CatalogItem, after: CatalogItem): string[] {
  const fields: string[] = [];
  for (const f of ['name', 'code', 'category', 'unit', 'modules'] as const) {
    if (before[f] !== after[f]) fields.push(f);
  }
  const a = before.attributes as Record<string, unknown>;
  const b = after.attributes as Record<string, unknown>;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[k] !== b[k]) fields.push(`attributes.${k}`);
  }
  return fields;
}

/**
 * What "Update catalog from library" would change: per item copy a price or attribute change
 * (the project's price next to the library's, so a price typed in the quote shows up as a
 * difference), per used item without a copy the library's item, per cable the library's price,
 * and the copies the library no longer has. Cables the library does not price are listed only
 * when the project has a price for them.
 */
export function catalogUpdateDiff(
  project: Pick<CopyTarget, 'doc' | 'items' | 'cablePrices'>,
  source: LibrarySource,
): CatalogUpdateDiff {
  const updates: CatalogUpdate[] = [];
  const missing: CatalogItem[] = [];
  const copies = new Map(project.items.map((i) => [i.id, i]));
  for (const copy of project.items) {
    const after = source.item(copy.id);
    if (!after) {
      missing.push(copy);
      continue;
    }
    const priceChanged = copy.unitPrice !== after.unitPrice;
    const changedFields = changedFieldsOf(copy, after);
    if (priceChanged || changedFields.length > 0) {
      updates.push({
        kind: 'item',
        key: copy.id,
        before: copy,
        after,
        priceChanged,
        changedFields,
      });
    }
  }
  for (const id of referencedItemIds(project.doc)) {
    if (copies.has(id)) continue;
    const after = source.item(id);
    // An unpriced item gains nothing from a copy: the built-in and the library still resolve it.
    if (after?.unitPrice !== undefined) {
      updates.push({ kind: 'item', key: id, after, priceChanged: true, changedFields: [] });
    }
  }
  for (const [key, spec] of cableKeysOf(project.doc)) {
    const before = project.cablePrices[key];
    const after = source.cablePrice(spec.crossSection, spec.color);
    if (before?.unitPrice === after?.unitPrice && before?.code === after?.code) continue;
    updates.push({
      kind: 'cable',
      key,
      ...spec,
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
    });
  }
  return { updates, missing };
}

/**
 * Applies the listed updates (by item id or cable key) from the library, in place: an item copy
 * is replaced by the library's item, a cable price by the library's price. Written to run inside
 * one command's recipe. Entries that are no longer a difference are skipped.
 */
export function applyCatalogUpdate(
  project: CopyTarget,
  source: LibrarySource,
  keys: ReadonlySet<string>,
): void {
  for (const update of catalogUpdateDiff(project, source).updates) {
    if (!keys.has(update.key)) continue;
    if (update.kind === 'cable') {
      if (update.after) project.cablePrices[update.key] = { ...update.after };
      else delete project.cablePrices[update.key];
      continue;
    }
    const next = structuredClone(update.after);
    const index = project.items.findIndex((i) => i.id === update.key);
    if (index >= 0) project.items[index] = next;
    else project.items.push(next);
  }
}
