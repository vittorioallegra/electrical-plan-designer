// Technical attributes the app computes with. Price-list items often lack them ("price only").
import type { CatalogItem } from './types';

type Needed = 'modules' | 'innerDiameter' | 'rails' | 'modulesPerRail';

/** What each category needs for box fill, panel layout and conduit fill. */
const NEEDED: Partial<Record<CatalogItem['category'], Needed[]>> = {
  device: ['modules'],
  blanking_cover: ['modules'],
  box: ['modules'],
  panel_device: ['modules'],
  conduit: ['innerDiameter'],
  enclosure: ['rails', 'modulesPerRail'],
};

/** Attributes the item lacks for its category; empty when it is complete. */
export function missingAttributes(item: CatalogItem): Needed[] {
  return (NEEDED[item.category] ?? []).filter((a) =>
    a === 'modules' ? item.modules === undefined : item.attributes[a] === undefined,
  );
}

export function isPriceOnly(item: CatalogItem): boolean {
  return missingAttributes(item).length > 0;
}
