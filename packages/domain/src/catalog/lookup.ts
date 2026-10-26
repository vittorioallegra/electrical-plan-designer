import { builtinById } from './builtin';
import type { CatalogItem, ProjectCatalog } from './types';

export type CatalogLookup = (id: string) => CatalogItem | undefined;

/**
 * The given items plus the built-ins (archived ones included: docs may reference them). An
 * item wins over the built-in of the same id: a project's copy of a built-in keeps its own
 * price, whatever a newer app version ships.
 */
export function createCatalogLookup(items: readonly CatalogItem[] = []): CatalogLookup {
  const other = new Map(items.map((i) => [i.id, i]));
  return (id) => other.get(id) ?? builtinById.get(id);
}

/** Every item of the project's imported catalogs, in catalog order. */
export function projectCatalogItems(catalogs: readonly ProjectCatalog[]): CatalogItem[] {
  return catalogs.flatMap((c) => c.items);
}

/**
 * The items a picker offers: the built-ins and the library's items, where a project's copy
 * stands in for the item of the same id, plus copies of items the library no longer has (the
 * drawing still uses them).
 */
export function pickerItems(
  builtins: readonly CatalogItem[],
  libraryItems: readonly CatalogItem[],
  projectItems: readonly CatalogItem[],
): CatalogItem[] {
  const copies = new Map(projectItems.map((i) => [i.id, i]));
  const listed = [...builtins, ...libraryItems].map((i) => copies.get(i.id) ?? i);
  const ids = new Set(listed.map((i) => i.id));
  return [...listed, ...projectItems.filter((i) => !ids.has(i.id))];
}
