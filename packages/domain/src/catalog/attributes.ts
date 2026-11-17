// Technical attributes the app computes with. Price-list items often lack them ("price only").
import type { CatalogItem } from './types';

type Needed = 'modules' | 'innerDiameter' | 'rails' | 'modulesPerRail' | 'smartMount';

/** What each category needs for box fill, panel layout and conduit fill. */
const NEEDED: Partial<Record<CatalogItem['category'], Needed[]>> = {
  device: ['modules'],
  blanking_cover: ['modules'],
  box: ['modules'],
  panel_device: ['modules'],
  conduit: ['innerDiameter'],
  enclosure: ['rails', 'modulesPerRail'],
  smart_device: ['smartMount'],
};

/** Attributes the item lacks for its category; empty when it is complete. */
export function missingAttributes(item: CatalogItem): Needed[] {
  // A smart device on a DIN rail also needs its width.
  const needed: Needed[] = isSmartDin(item)
    ? ['smartMount', 'modules']
    : (NEEDED[item.category] ?? []);
  return needed.filter((a) =>
    a === 'modules' ? item.modules === undefined : item.attributes[a] === undefined,
  );
}

/** A smart device that sits on the panel's DIN rail (a Shelly Pro). */
export function isSmartDin(item: Pick<CatalogItem, 'category' | 'attributes'>): boolean {
  return item.category === 'smart_device' && item.attributes.smartMount === 'din';
}

/** A smart device that sits inside a flush or junction box (a Shelly 1PM Mini). */
export function isSmartBox(item: Pick<CatalogItem, 'category' | 'attributes'>): boolean {
  return item.category === 'smart_device' && item.attributes.smartMount === 'box';
}

/**
 * Whether a panel device with this item can be the origin of a circuit: anything but a smart
 * device, which only takes room on the rail. A missing item is not ruled out.
 */
export function canFeedCircuit(item: Pick<CatalogItem, 'category'> | undefined): boolean {
  return item?.category !== 'smart_device';
}

/** An item that can sit on a panel's rail: a panel device or a DIN smart device. */
export function isRailItem(item: Pick<CatalogItem, 'category' | 'attributes'>): boolean {
  return item.category === 'panel_device' || isSmartDin(item);
}

export function isPriceOnly(item: CatalogItem): boolean {
  return missingAttributes(item).length > 0;
}
