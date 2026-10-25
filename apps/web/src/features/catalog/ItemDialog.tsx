import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cableColorSchema } from '@epd/domain/schema';
import type {
  CatalogAttributes,
  CatalogCategory,
  CatalogItem,
  DeviceType,
  PanelDeviceType,
} from '@epd/domain/catalog/types';
import type { NewCatalogItem } from '@/data/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { NumberInput } from '@/ui/NumberInput';
import { TextField } from '@/ui/TextField';

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
const deviceTypes: DeviceType[] = [
  'socket',
  'schuko',
  'universal_socket',
  'switch',
  'two_way',
  'intermediate',
  'push_button',
  'dimmer',
  'usb',
  'tv',
  'data',
  'other',
];
const panelDeviceTypes: PanelDeviceType[] = ['mcb', 'rcd', 'rcbo', 'isolator', 'spd', 'other'];
const withModules = new Set<CatalogCategory>([
  'device',
  'blanking_cover',
  'plate',
  'box',
  'panel_device',
]);

export function defaultUnit(category: CatalogCategory): 'pcs' | 'm' {
  return category === 'conduit' || category === 'cable' ? 'm' : 'pcs';
}

/** Create/edit dialog for a user item. `initial` without an id duplicates. */
export function ItemDialog({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: Partial<CatalogItem> & { category: CatalogCategory };
  title: string;
  onClose: () => void;
  onSave: (item: NewCatalogItem) => Promise<void>;
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
  const [busy, setBusy] = useState(false);
  const attr = <K extends keyof CatalogAttributes>(key: K, value: CatalogAttributes[K] | null) =>
    setAttributes((a) => {
      const next = { ...a };
      if (value === null || value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  const num = (
    key:
      | 'outerDiameter'
      | 'innerDiameter'
      | 'crossSection'
      | 'ratingA'
      | 'sensitivityMa'
      | 'rails'
      | 'modulesPerRail',
    unit: string,
  ) => (
    <label className="flex flex-col gap-1">
      {t(`catalog.attr.${key}`)}
      <NumberInput
        aria-label={t(`catalog.attr.${key}`)}
        live
        value={attributes[key] ?? null}
        unit={unit}
        min={0}
        onValueChange={(v) => attr(key, v)}
      />
    </label>
  );
  const select = <K extends 'deviceType' | 'panelDeviceType' | 'curve' | 'rcdType' | 'color'>(
    key: K,
    options: readonly string[],
    labelOf: (o: string) => string,
  ) => (
    <label className="flex flex-col gap-1">
      {t(`catalog.attr.${key}`)}
      <select
        className="h-[var(--control-height)] rounded border border-border px-2"
        value={(attributes[key] as string | undefined) ?? ''}
        onChange={(e) => attr(key, (e.target.value || null) as CatalogAttributes[K] | null)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelOf(o)}
          </option>
        ))}
      </select>
    </label>
  );

  async function submit() {
    setBusy(true);
    const enclosureModules =
      category === 'enclosure' && attributes.rails && attributes.modulesPerRail
        ? attributes.rails * attributes.modulesPerRail
        : null;
    const mods = enclosureModules ?? (withModules.has(category) ? modules : null);
    await onSave({
      category,
      name: name.trim(),
      ...(code.trim() ? { code: code.trim() } : {}),
      ...(price !== null ? { unitPrice: Math.round(price * 100) } : {}),
      unit: defaultUnit(category),
      ...(mods ? { modules: mods } : {}),
      attributes,
      archived: initial.archived ?? false,
    });
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title}>
      <form
        className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="col-span-2 flex flex-col gap-1">
          {t('catalog.category')}
          <select
            className="h-[var(--control-height)] rounded border border-border px-2"
            value={category}
            disabled={initial.id !== undefined}
            onChange={(e) => {
              setCategory(e.target.value as CatalogCategory);
              setAttributes({});
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(`catalog.categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
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
        <label className="flex flex-col gap-1">
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
          <label className="flex flex-col gap-1">
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
        {category === 'device'
          ? select('deviceType', deviceTypes, (o) => t(`catalog.deviceTypes.${o}`))
          : null}
        {category === 'conduit' ? (
          <>
            {num('outerDiameter', 'mm')}
            {num('innerDiameter', 'mm')}
          </>
        ) : null}
        {category === 'cable' ? (
          <>
            {num('crossSection', 'mm²')}
            {num('outerDiameter', 'mm')}
            {select('color', cableColorSchema.options, (o) => t(`colors.${o}`))}
          </>
        ) : null}
        {category === 'panel_device' ? (
          <>
            {select('panelDeviceType', panelDeviceTypes, (o) => t(`catalog.panelDeviceTypes.${o}`))}
            <TextField
              label={t('catalog.attr.poles')}
              value={attributes.poles ?? ''}
              onChange={(e) => attr('poles', e.target.value || null)}
            />
            {num('ratingA', 'A')}
            {select('curve', ['B', 'C', 'D'], (o) => o)}
            {num('sensitivityMa', 'mA')}
            {select('rcdType', ['A', 'AC', 'F', 'B'], (o) => o)}
          </>
        ) : null}
        {category === 'enclosure' ? (
          <>
            {num('rails', '')}
            {num('modulesPerRail', '')}
          </>
        ) : null}
        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim() === ''}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
