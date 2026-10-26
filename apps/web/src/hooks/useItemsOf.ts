import { useMemo } from 'react';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import { pickerItems, projectCatalogItems } from '@epd/domain/catalog/lookup';
import type { CatalogCategory, CatalogItem } from '@epd/domain/catalog/types';
import { useEditor } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';

/**
 * Items of one category for pickers: the library's (and the built-ins), where the project's
 * copy stands in for items it already uses; not archived, not left over from a catalog replace.
 */
export function useItemsOf(category: CatalogCategory): CatalogItem[] {
  const catalogs = useLibrary((s) => s.library.catalogs);
  const projectItems = useEditor((s) => s.data.items);
  return useMemo(
    () =>
      pickerItems(builtinCatalog, projectCatalogItems(catalogs), projectItems).filter(
        (i) => i.category === category && !i.archived && !i.missing,
      ),
    [catalogs, projectItems, category],
  );
}
