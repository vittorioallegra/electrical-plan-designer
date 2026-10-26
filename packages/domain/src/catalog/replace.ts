// Project catalogs: creating one from imported items and replacing it with a newer list.
// Items are matched by `code`; a matched item keeps its id, so the drawing keeps pointing at it.
import { newId, type IdGenerator } from '../ids';
import type { BoxPreset, ProjectDoc } from '../types';
import type { CatalogItem, ProjectCatalog } from './types';

/** An item read from an import (CSV, `.epc`), before it gets an id in the project. */
export type IncomingItem = Omit<CatalogItem, 'id' | 'archived' | 'editedAt' | 'missing'>;

export interface IncomingCatalog {
  name: string;
  source?: string;
  items: IncomingItem[];
}

export function catalogItemId(
  catalogId: string,
  code: string | undefined,
  genId: IdGenerator = newId,
): string {
  return `${catalogId}:${code ?? genId()}`;
}

function toItem(item: IncomingItem, id: string): CatalogItem {
  return { ...structuredClone(item), id };
}

/** Ids for incoming items: by code, a generated one when the code is missing or repeated. */
function assignIds(
  catalogId: string,
  items: readonly IncomingItem[],
  taken: Set<string>,
  genId: IdGenerator,
): string[] {
  return items.map((item) => {
    let id = catalogItemId(catalogId, item.code, genId);
    while (taken.has(id)) id = catalogItemId(catalogId, undefined, genId);
    taken.add(id);
    return id;
  });
}

export function createProjectCatalog(
  incoming: IncomingCatalog,
  now: Date,
  genId: IdGenerator = newId,
): ProjectCatalog {
  const id = genId();
  const ids = assignIds(id, incoming.items, new Set(), genId);
  return {
    id,
    name: incoming.name,
    importedAt: now.toISOString(),
    ...(incoming.source === undefined ? {} : { source: incoming.source }),
    items: incoming.items.map((item, i) => toItem(item, ids[i]!)),
  };
}

/** Catalog item ids referenced by the drawing or by box presets. */
export function usedItemIds(
  doc: Pick<ProjectDoc, 'nodes' | 'segments' | 'panels'>,
  boxPresets: readonly BoxPreset[] = [],
): Set<string> {
  const used = new Set<string>();
  for (const n of doc.nodes) {
    if (n.boxItemId !== undefined) used.add(n.boxItemId);
    for (const c of n.contents ?? []) used.add(c.itemId);
  }
  for (const s of doc.segments) used.add(s.conduitItemId);
  for (const p of doc.panels) {
    if (p.enclosureItemId !== undefined) used.add(p.enclosureItemId);
    for (const d of p.devices) used.add(d.itemId);
  }
  for (const preset of boxPresets) {
    if (preset.boxItemId !== undefined) used.add(preset.boxItemId);
    for (const c of preset.contents) used.add(c.itemId);
  }
  return used;
}

export interface MatchedItem {
  before: CatalogItem;
  after: IncomingItem;
}

export interface ChangedItem extends MatchedItem {
  priceChanged: boolean;
  /** The current item was edited by hand: the user chooses to keep or overwrite it. */
  editConflict: boolean;
}

export interface MissingItem {
  item: CatalogItem;
  /** In use items stay (marked `missing`); unused ones are dropped. */
  inUse: boolean;
}

export interface CatalogReplaceDiff {
  changed: ChangedItem[];
  unchanged: MatchedItem[];
  added: IncomingItem[];
  missing: MissingItem[];
}

const DATA_FIELDS = ['category', 'name', 'code', 'unitPrice', 'unit', 'modules'] as const;

function sameData(a: CatalogItem, b: IncomingItem): boolean {
  return (
    DATA_FIELDS.every((f) => a[f] === b[f]) &&
    JSON.stringify(sortKeys(a.attributes)) === JSON.stringify(sortKeys(b.attributes))
  );
}

function sortKeys(o: object): [string, unknown][] {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
}

/** What replacing `current` with `incoming` would change; the first item per code is matched. */
export function diffCatalogReplacement(
  current: ProjectCatalog,
  incoming: readonly IncomingItem[],
  used: ReadonlySet<string>,
): CatalogReplaceDiff {
  const byCode = new Map<string, CatalogItem>();
  for (const item of current.items) {
    if (item.code !== undefined && !byCode.has(item.code)) byCode.set(item.code, item);
  }
  const diff: CatalogReplaceDiff = { changed: [], unchanged: [], added: [], missing: [] };
  const matched = new Set<string>();
  for (const after of incoming) {
    const before = after.code === undefined ? undefined : byCode.get(after.code);
    if (!before || matched.has(before.id)) {
      diff.added.push(after);
      continue;
    }
    matched.add(before.id);
    if (sameData(before, after) && !before.missing) {
      diff.unchanged.push({ before, after });
    } else {
      diff.changed.push({
        before,
        after,
        priceChanged: before.unitPrice !== after.unitPrice,
        editConflict: before.editedAt !== undefined,
      });
    }
  }
  for (const item of current.items) {
    if (!matched.has(item.id)) diff.missing.push({ item, inUse: used.has(item.id) });
  }
  return diff;
}

export interface ReplaceChoices {
  /** Ids of hand-edited items to keep as they are instead of overwriting. */
  keepEdited?: ReadonlySet<string>;
}

/**
 * The catalog after replacing its items with `incoming`: matched items keep their id and take
 * the new data (unless kept), new items are added, missing items in use stay marked `missing`.
 */
export function replaceCatalog(
  current: ProjectCatalog,
  incoming: IncomingCatalog,
  used: ReadonlySet<string>,
  choices: ReplaceChoices,
  now: Date,
  genId: IdGenerator = newId,
): ProjectCatalog {
  const diff = diffCatalogReplacement(current, incoming.items, used);
  const keep = choices.keepEdited ?? new Set<string>();
  const matchedIds = new Map<IncomingItem, CatalogItem>();
  for (const m of [...diff.unchanged, ...diff.changed]) matchedIds.set(m.after, m.before);
  const kept = diff.missing.filter((m) => m.inUse).map((m) => m.item);

  const taken = new Set(current.items.map((i) => i.id));
  const addedIds = assignIds(current.id, diff.added, taken, genId);
  const added = new Map(diff.added.map((item, i) => [item, addedIds[i]!]));

  const items = incoming.items.map((after) => {
    const before = matchedIds.get(after);
    if (before) {
      return before.editedAt !== undefined && keep.has(before.id)
        ? structuredClone(before)
        : toItem(after, before.id);
    }
    return toItem(after, added.get(after)!);
  });
  return {
    id: current.id,
    name: incoming.name,
    importedAt: now.toISOString(),
    ...(incoming.source === undefined ? {} : { source: incoming.source }),
    items: [...items, ...kept.map((item) => ({ ...structuredClone(item), missing: true }))],
  };
}
