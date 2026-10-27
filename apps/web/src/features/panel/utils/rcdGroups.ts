import type { CatalogLookup } from '@epd/domain/catalog/lookup';
import { isRcdType } from '@epd/domain/panel';
import type { PanelDevice } from '@epd/domain/types';

const groupColors = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-rcd-${n})`);

/**
 * Color of each RCD group: every RCD gets the next color, and devices downstream of it
 * (through any chain of upstream links) share it. Devices outside any RCD group have none.
 */
export function rcdGroupColors(
  devices: readonly PanelDevice[],
  lookup: CatalogLookup,
): Map<string, string> {
  const colors = new Map<string, string>();
  const byId = new Map(devices.map((d) => [d.id, d]));
  let i = 0;
  for (const d of devices) {
    if (isRcdType(d, lookup)) colors.set(d.id, groupColors[i++ % groupColors.length]!);
  }
  for (const d of devices) {
    let up = d.upstreamDeviceId ? byId.get(d.upstreamDeviceId) : undefined;
    for (let depth = 0; up && !colors.has(d.id) && depth < 32; depth++) {
      if (colors.has(up.id) && isRcdType(up, lookup)) colors.set(d.id, colors.get(up.id)!);
      up = up.upstreamDeviceId ? byId.get(up.upstreamDeviceId) : undefined;
    }
  }
  return colors;
}
