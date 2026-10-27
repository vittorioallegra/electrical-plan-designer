import { useMemo } from 'react';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import {
  createCatalogLookup,
  projectCatalogItems,
  type CatalogLookup,
} from '@epd/domain/catalog/lookup';
import type { CatalogItem, ProjectCatalog } from '@epd/domain/catalog/types';
import type { BoxPreset, PriceOverrides } from '@epd/domain/types';
import { useLibrary } from '@/stores/library/useLibrary';

export interface LibraryCatalogState {
  /** Built-ins + every item of the library's catalogs (archived and missing included). */
  items: CatalogItem[];
  catalogs: ProjectCatalog[];
  lookup: CatalogLookup;
  priceOverrides: PriceOverrides;
  boxPresets: BoxPreset[];
}

/** Catalogs, prices and box presets of the library. */
export function useLibraryCatalog(): LibraryCatalogState {
  const catalogs = useLibrary((s) => s.library.catalogs);
  const priceOverrides = useLibrary((s) => s.library.priceOverrides);
  const boxPresets = useLibrary((s) => s.library.boxPresets);
  return useMemo(() => {
    const libraryItems = projectCatalogItems(catalogs);
    return {
      items: [...builtinCatalog, ...libraryItems],
      catalogs,
      lookup: createCatalogLookup(libraryItems),
      priceOverrides,
      boxPresets,
    };
  }, [catalogs, priceOverrides, boxPresets]);
}
