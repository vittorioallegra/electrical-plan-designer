import type { TFunction } from 'i18next';
import type { BomLine } from '@/domain/bom';
import type { CatalogLookup } from '@/domain/catalog/lookup';
import type { CatalogItem } from '@/domain/catalog/types';
import { formatNumber, type Locale } from '@/ui/format';

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
