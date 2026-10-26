import { useMemo } from 'react';
import type { CatalogCategory, CatalogItem } from '@epd/domain/catalog/types';
import { useCatalog } from '@/hooks/useCatalog';

/** Items of one category for pickers: not archived, not left over from a catalog replace. */
export function useItemsOf(category: CatalogCategory): CatalogItem[] {
  const { items } = useCatalog();
  return useMemo(
    () => items.filter((i) => i.category === category && !i.archived && !i.missing),
    [items, category],
  );
}
