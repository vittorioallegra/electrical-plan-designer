import { useMemo } from 'react';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import {
  createCatalogLookup,
  projectCatalogItems,
  type CatalogLookup,
} from '@epd/domain/catalog/lookup';
import type { CatalogItem, ProjectCatalog } from '@epd/domain/catalog/types';
import type { Company } from '@epd/domain/projectFile';
import type { BoxPreset, PriceOverrides } from '@epd/domain/types';
import { useEditor } from '@/stores/editor/EditorContext';

export interface CatalogState {
  /** Built-ins + every item of the project's catalogs (archived and missing included). */
  items: CatalogItem[];
  /** Items of the project's catalogs. */
  projectItems: CatalogItem[];
  catalogs: ProjectCatalog[];
  lookup: CatalogLookup;
  priceOverrides: PriceOverrides;
  boxPresets: BoxPreset[];
  company: Company;
}

/** Catalogs, prices, box presets and company of the open project. */
export function useCatalog(): CatalogState {
  const catalogs = useEditor((s) => s.data.catalogs);
  const priceOverrides = useEditor((s) => s.data.priceOverrides);
  const boxPresets = useEditor((s) => s.data.boxPresets);
  const company = useEditor((s) => s.data.company);
  return useMemo(() => {
    const projectItems = projectCatalogItems(catalogs);
    return {
      items: [...builtinCatalog, ...projectItems],
      projectItems,
      catalogs,
      lookup: createCatalogLookup(projectItems),
      priceOverrides,
      boxPresets,
      company,
    };
  }, [catalogs, priceOverrides, boxPresets, company]);
}
