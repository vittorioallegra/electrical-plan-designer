import { builtinById } from './builtin';
import type { CatalogItem } from './types';

export type CatalogLookup = (id: string) => CatalogItem | undefined;

/** Built-ins plus the account's user items (archived ones included: docs may reference them). */
export function createCatalogLookup(userItems: readonly CatalogItem[] = []): CatalogLookup {
  const user = new Map(userItems.map((i) => [i.id, i]));
  return (id) => builtinById.get(id) ?? user.get(id);
}
