import type { TFunction } from 'i18next';
import type { BomLine } from '@epd/domain/bom';
import type { CableColor } from '@epd/domain/types';
import type { CatalogLookup } from '@epd/domain/catalog/lookup';
import type { CatalogItem } from '@epd/domain/catalog/types';
import { formatNumber, type Locale } from './format';

/** Human description of a BOM line in the UI language. */
export function describeBomLine(
  line: BomLine,
  lookup: CatalogLookup,
  t: TFunction,
  locale: Locale,
): string {
  if (line.cable) {
    return t('bom.cableLine', {
      section: formatNumber(line.cable.crossSection, locale),
      color: t(`colors.${line.cable.color}`),
    });
  }
  const item: CatalogItem | undefined = line.itemId ? lookup(line.itemId) : undefined;
  if (!item) return t('catalog.missingItem', { id: line.itemId ?? line.key });
  return item.ownerId === null ? t(item.name) : item.name;
}

/** Description of a purchase mark whose line may have left the BOM (key only). */
export function describeLineKey(
  key: string,
  lookup: CatalogLookup,
  t: TFunction,
  locale: Locale,
): string {
  const cable = /^cable:([\d.]+):(.+)$/.exec(key);
  const line: BomLine = cable
    ? {
        key,
        category: 'cable',
        cable: { crossSection: Number(cable[1]), color: cable[2] as CableColor },
        quantity: 0,
        unit: 'm',
      }
    : { key, category: 'missing', itemId: key, quantity: 0, unit: 'pcs' };
  return describeBomLine(line, lookup, t, locale);
}
