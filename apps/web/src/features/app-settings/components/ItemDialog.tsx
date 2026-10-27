import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogAttributes, CatalogCategory, CatalogItem } from '@epd/domain/catalog/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { AttributeFields } from './AttributeFields';

export const categories: CatalogCategory[] = [
  'device',
  'blanking_cover',
  'plate',
  'box',
  'junction_box',
  'conduit',
  'cable',
  'panel_device',
  'enclosure',
];
/** An item as the dialog edits it; the page gives it its id and catalog. */
export type ItemDraft = Omit<CatalogItem, 'id'>;

export const withModules = new Set<CatalogCategory>([
  'device',
  'blanking_cover',
  'plate',
  'box',
  'panel_device',
]);

export function defaultUnit(category: CatalogCategory): 'pcs' | 'm' {
  return category === 'conduit' || category === 'cable' ? 'm' : 'pcs';
}

/** Create/edit dialog for a project catalog item. `initial` without an id duplicates. */
export function ItemDialog({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: Partial<CatalogItem> & { category: CatalogCategory };
  title: string;
  onClose: () => void;
  onSave: (item: ItemDraft) => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CatalogCategory>(initial.category);
  const [name, setName] = useState(initial.name ?? '');
  const [code, setCode] = useState(initial.code ?? '');
  const [price, setPrice] = useState<number | null>(
    initial.unitPrice !== undefined ? initial.unitPrice / 100 : null,
  );
  const [modules, setModules] = useState<number | null>(initial.modules ?? null);
  const [attributes, setAttributes] = useState<CatalogAttributes>(initial.attributes ?? {});
  const attr = <K extends keyof CatalogAttributes>(key: K, value: CatalogAttributes[K] | null) =>
    setAttributes((a) => {
      const next = { ...a };
      if (value === null || value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  function submit() {
    const enclosureModules =
      category === 'enclosure' && attributes.rails && attributes.modulesPerRail
        ? attributes.rails * attributes.modulesPerRail
        : null;
    const mods = enclosureModules ?? (withModules.has(category) ? modules : null);
    onSave({
      category,
      name: name.trim(),
      ...(code.trim() ? { code: code.trim() } : {}),
      ...(price !== null ? { unitPrice: Math.round(price * 100) } : {}),
      unit: defaultUnit(category),
      ...(mods ? { modules: mods } : {}),
      attributes,
      archived: initial.archived ?? false,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title}>
      <form
        className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="col-span-2 flex flex-col gap-1 text-small text-text-muted">
          {t('catalog.category')}
          <Select
            aria-label={t('catalog.category')}
            value={category}
            options={categories.map((c) => ({ value: c, label: t(`catalog.categories.${c}`) }))}
            onValueChange={(v) => {
              setCategory(v as CatalogCategory);
              setAttributes({});
            }}
          />
        </div>
        <TextField
          className="col-span-2"
          label={t('catalog.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label={t('catalog.code')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <label className="flex flex-col gap-1 text-small text-text-muted">
          {t('catalog.price', { unit: t(`catalog.units.${defaultUnit(category)}`) })}
          <NumberInput
            aria-label={t('catalog.priceLabel')}
            live
            value={price}
            unit="€"
            min={0}
            onValueChange={setPrice}
          />
        </label>
        {withModules.has(category) ? (
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t('catalog.modules')}
            <NumberInput
              aria-label={t('catalog.modules')}
              live
              decimals={0}
              value={modules}
              min={1}
              max={72}
              onValueChange={setModules}
            />
          </label>
        ) : null}
        <AttributeFields category={category} attributes={attributes} onChange={attr} live />
        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={name.trim() === ''}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
