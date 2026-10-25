// Panel layout helpers: device widths, free slots, totals and enclosure suggestion.
import type { CatalogLookup } from './catalog/lookup';
import type { CatalogItem } from './catalog/types';
import type { Panel, PanelDevice } from './types';

export function deviceWidth(device: Pick<PanelDevice, 'itemId'>, catalog: CatalogLookup): number {
  return Math.max(1, catalog(device.itemId)?.modules ?? 1);
}

export function totalModules(panel: Panel, catalog: CatalogLookup): number {
  return panel.devices.reduce((sum, d) => sum + deviceWidth(d, catalog), 0);
}

/** True when [slot, slot + width) on `rail` is inside the panel and free (ignoring `exceptId`). */
export function isFree(
  panel: Panel,
  catalog: CatalogLookup,
  rail: number,
  slot: number,
  width: number,
  exceptId?: string,
): boolean {
  if (rail < 0 || rail >= panel.dinRails || slot < 0 || slot + width > panel.modulesPerRail)
    return false;
  return panel.devices.every((d) => {
    if (d.id === exceptId || d.rail !== rail) return true;
    const end = d.slot + deviceWidth(d, catalog);
    return slot + width <= d.slot || end <= slot;
  });
}

/** First free position for a device of `width` modules, scanning rails top to bottom. */
export function firstFreeSlot(
  panel: Panel,
  catalog: CatalogLookup,
  width: number,
): { rail: number; slot: number } | null {
  for (let rail = 0; rail < panel.dinRails; rail++) {
    for (let slot = 0; slot + width <= panel.modulesPerRail; slot++) {
      if (isFree(panel, catalog, rail, slot, width)) return { rail, slot };
    }
  }
  return null;
}

/** Smallest enclosure with at least `modules` modules (ties: fewer rails). */
export function suggestEnclosure(
  modules: number,
  enclosures: readonly CatalogItem[],
): CatalogItem | undefined {
  return [...enclosures]
    .filter((e) => !e.archived && (e.modules ?? 0) >= modules)
    .sort(
      (a, b) =>
        (a.modules ?? 0) - (b.modules ?? 0) ||
        (a.attributes.rails ?? 1) - (b.attributes.rails ?? 1),
    )[0];
}

/** Devices whose protection chain contains an RCD or RCBO (themselves included). */
export function isRcdType(device: PanelDevice, catalog: CatalogLookup): boolean {
  const type = catalog(device.itemId)?.attributes.panelDeviceType;
  return type === 'rcd' || type === 'rcbo';
}
