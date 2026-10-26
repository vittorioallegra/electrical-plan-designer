import { useMemo } from 'react';
import { createCatalogLookup, type CatalogLookup } from '@epd/domain/catalog/lookup';
import type { CatalogItem } from '@epd/domain/catalog/types';
import type { CablePrices } from '@epd/domain/types';
import { useEditor } from '@/stores/editor/EditorContext';

export interface CatalogState {
  /** The project's copies of the items it uses. */
  items: CatalogItem[];
  /** Copies first, built-ins for ids not copied yet: never the library. */
  lookup: CatalogLookup;
  cablePrices: CablePrices;
}

/**
 * The pricing view of the open project: its own copies of items and cable prices. BOM, checks,
 * quotes and panel helpers read this, so they never depend on the library. Pickers use
 * `useItemsOf`, which shows the library.
 */
export function useCatalog(): CatalogState {
  const items = useEditor((s) => s.data.items);
  const cablePrices = useEditor((s) => s.data.cablePrices);
  return useMemo(
    () => ({ items, lookup: createCatalogLookup(items), cablePrices }),
    [items, cablePrices],
  );
}
