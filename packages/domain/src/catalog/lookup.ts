import { builtinById } from './builtin';
import type { CatalogItem, ProjectCatalog } from './types';

export type CatalogLookup = (id: string) => CatalogItem | undefined;

/** Built-ins plus the given items (archived ones included: docs may reference them). */
export function createCatalogLookup(items: readonly CatalogItem[] = []): CatalogLookup {
  const other = new Map(items.map((i) => [i.id, i]));
  return (id) => builtinById.get(id) ?? other.get(id);
}

/** Every item of the project's imported catalogs, in catalog order. */
export function projectCatalogItems(catalogs: readonly ProjectCatalog[]): CatalogItem[] {
  return catalogs.flatMap((c) => c.items);
}
