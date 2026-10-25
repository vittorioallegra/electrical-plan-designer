import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '@epd/domain/catalog/types';

/** Display name of a catalog item (built-in names are i18n keys). */
export function useItemName(): (item: CatalogItem | undefined, fallbackId?: string) => string {
  const { t } = useTranslation();
  return useCallback(
    (item, fallbackId) =>
      item
        ? item.ownerId === null
          ? t(item.name)
          : item.name
        : t('catalog.missingItem', { id: fallbackId ?? '' }),
    [t],
  );
}
