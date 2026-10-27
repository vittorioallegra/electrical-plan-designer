import { Archive, ArchiveRestore, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isPriceOnly } from '@epd/domain/catalog/attributes';
import { isBuiltin, type CatalogAttributes, type CatalogItem } from '@epd/domain/catalog/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { PanelSection } from '@/components/ui/PanelSection';
import { useItemName } from '@/hooks/useItemName';
import { AttributeFields, CommitText } from './AttributeFields';
import { defaultUnit, withModules } from './ItemDialog';

/** A change to an item's own fields; the page stamps it as edited by hand. */
export type ItemEdit =
  | { field: 'name'; value: string }
  | { field: 'code'; value: string }
  | { field: 'unitPrice'; value: number }
  | { field: 'modules'; value: number }
  | {
      field: 'attribute';
      key: keyof CatalogAttributes;
      value: CatalogAttributes[keyof CatalogAttributes] | null;
    };

/**
 * The selected item beside the table. Price and fields are edited here and commit on blur or
 * Enter, like every number field; a built-in only has its price (an override of the library).
 * `price` is the effective price in cents, the override for a built-in.
 */
export function ItemDetail({
  item,
  catalogName,
  price,
  onPrice,
  onEdit,
  onDuplicate,
  onArchive,
}: {
  item: CatalogItem;
  catalogName: string;
  price: number | undefined;
  /** Euros; a built-in stores it as a price override. */
  onPrice: (euros: number) => void;
  onEdit: (edit: ItemEdit) => void;
  onDuplicate: () => void;
  onArchive: (archived: boolean) => void;
}) {
  const { t } = useTranslation();
  const itemName = useItemName();
  const builtin = isBuiltin(item);
  const name = itemName(item);
  const unit = t(`catalog.units.${defaultUnit(item.category)}`);
  return (
    <div className="flex h-full flex-col" data-testid="item-detail">
      <div className="border-b border-border px-4 py-3">
        <div className="truncate text-small text-text-faint">
          {catalogName} · {t(`catalog.categories.${item.category}`)}
        </div>
        <h2 className="mt-0.5 text-heading font-semibold">{name}</h2>
        <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
          {item.archived ? <Badge>{t('catalog.archivedBadge')}</Badge> : null}
          {item.missing ? (
            <Badge tone="warning">{t('catalog.missingBadge')}</Badge>
          ) : !builtin && isPriceOnly(item) ? (
            <Badge tone="warning">{t('catalog.priceOnlyBadge')}</Badge>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelSection title={t('catalog.priceLabel')}>
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t('catalog.price', { unit })}
            <NumberInput
              aria-label={t('catalog.priceFor', { name })}
              value={price !== undefined ? price / 100 : null}
              placeholder={t('catalog.unpriced')}
              unit="€"
              min={0}
              onValueChange={onPrice}
            />
          </label>
        </PanelSection>
        <PanelSection title={t('catalog.data')}>
          {builtin ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {item.code ? (
                <>
                  <dt className="text-text-muted">{t('catalog.code')}</dt>
                  <dd className="text-right font-mono">{item.code}</dd>
                </>
              ) : null}
              {item.modules ? (
                <>
                  <dt className="text-text-muted">{t('catalog.modules')}</dt>
                  <dd className="text-right font-mono">{item.modules}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <CommitText
                className="col-span-2"
                label={t('catalog.name')}
                value={item.name}
                live={false}
                required
                onCommit={(value) => onEdit({ field: 'name', value })}
              />
              <CommitText
                label={t('catalog.code')}
                value={item.code ?? ''}
                live={false}
                onCommit={(value) => onEdit({ field: 'code', value })}
              />
              {withModules.has(item.category) ? (
                <label className="flex flex-col gap-1 text-small text-text-muted">
                  {t('catalog.modules')}
                  <NumberInput
                    aria-label={t('catalog.modules')}
                    decimals={0}
                    value={item.modules ?? null}
                    min={1}
                    max={72}
                    onValueChange={(value) => onEdit({ field: 'modules', value })}
                  />
                </label>
              ) : null}
              <AttributeFields
                category={item.category}
                attributes={item.attributes}
                live={false}
                onChange={(key, value) => onEdit({ field: 'attribute', key, value })}
              />
            </div>
          )}
        </PanelSection>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        {!builtin ? (
          <Button variant="ghost" onClick={() => onArchive(!item.archived)}>
            {item.archived ? (
              <ArchiveRestore size={14} aria-hidden />
            ) : (
              <Archive size={14} aria-hidden />
            )}
            {item.archived ? t('catalog.restoreItem') : t('catalog.archiveItem')}
          </Button>
        ) : null}
        <Button onClick={onDuplicate}>
          <Copy size={14} aria-hidden />
          {t('catalog.duplicateItem')}
        </Button>
      </div>
    </div>
  );
}
