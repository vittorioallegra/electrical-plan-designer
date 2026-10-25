import { useMemo } from 'react';
import type { CatalogCategory, CatalogItem } from '@epd/domain/catalog/types';
import { useCatalog } from '@/api/catalog';

/** Non-archived items of one category, for pickers. */
export function useItemsOf(category: CatalogCategory): CatalogItem[] {
  const { items } = useCatalog();
  return useMemo(
    () => items.filter((i) => i.category === category && !i.archived),
    [items, category],
  );
}
