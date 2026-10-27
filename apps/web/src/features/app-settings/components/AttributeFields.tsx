import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cableColorSchema } from '@epd/domain/schema';
import type {
  CatalogAttributes,
  CatalogCategory,
  DeviceType,
  PanelDeviceType,
} from '@epd/domain/catalog/types';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';

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

type NumericKey =
  | 'outerDiameter'
  | 'innerDiameter'
  | 'crossSection'
  | 'ratingA'
  | 'sensitivityMa'
  | 'rails'
  | 'modulesPerRail';
type ChoiceKey = 'deviceType' | 'panelDeviceType' | 'curve' | 'rcdType' | 'color';

const labelClass = 'flex flex-col gap-1 text-small text-text-muted';

/**
 * The category-specific attribute fields of a catalog item. `live` reports every valid number
 * while typing (the dialog); otherwise numbers and text commit on blur or Enter (the detail
 * panel). `onChange` gets the key and the new value, or null to clear it.
 */
export function AttributeFields({
  category,
  attributes,
  onChange,
  live,
}: {
  category: CatalogCategory;
  attributes: CatalogAttributes;
  onChange: <K extends keyof CatalogAttributes>(key: K, value: CatalogAttributes[K] | null) => void;
  live: boolean;
}) {
  const { t } = useTranslation();
  const num = (key: NumericKey, unit: string) => (
    <label className={labelClass}>
      {t(`catalog.attr.${key}`)}
      <NumberInput
        aria-label={t(`catalog.attr.${key}`)}
        live={live}
        value={attributes[key] ?? null}
        unit={unit}
        min={0}
        onValueChange={(v) => onChange(key, v)}
      />
    </label>
  );
  const choice = (key: ChoiceKey, options: readonly string[], labelOf: (o: string) => string) => (
    <div className={labelClass}>
      {t(`catalog.attr.${key}`)}
      <Select
        aria-label={t(`catalog.attr.${key}`)}
        value={(attributes[key] as string | undefined) ?? ''}
        options={[
          { value: '', label: '—' },
          ...options.map((o) => ({ value: o, label: labelOf(o) })),
        ]}
        onValueChange={(v) => onChange(key, (v || null) as CatalogAttributes[ChoiceKey] | null)}
      />
    </div>
  );
  return (
    <>
      {category === 'device'
        ? choice('deviceType', deviceTypes, (o) => t(`catalog.deviceTypes.${o}`))
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
          {choice('color', cableColorSchema.options, (o) => t(`colors.${o}`))}
        </>
      ) : null}
      {category === 'panel_device' ? (
        <>
          {choice('panelDeviceType', panelDeviceTypes, (o) => t(`catalog.panelDeviceTypes.${o}`))}
          <CommitText
            label={t('catalog.attr.poles')}
            value={attributes.poles ?? ''}
            live={live}
            onCommit={(v) => onChange('poles', v || null)}
          />
          {num('ratingA', 'A')}
          {choice('curve', ['B', 'C', 'D'], (o) => o)}
          {num('sensitivityMa', 'mA')}
          {choice('rcdType', ['A', 'AC', 'F', 'B'], (o) => o)}
        </>
      ) : null}
      {category === 'enclosure' ? (
        <>
          {num('rails', '')}
          {num('modulesPerRail', '')}
        </>
      ) : null}
    </>
  );
}

/** Text field that reports on every keystroke (`live`) or on blur and Enter. */
export function CommitText({
  label,
  value,
  live,
  onCommit,
  className,
  required,
}: {
  label: string;
  value: string;
  live: boolean;
  onCommit: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  const [text, setText] = useDraft(value);
  const commit = () => {
    if (required && text.trim() === '') setText(value);
    else if (text.trim() !== value) onCommit(text.trim());
  };
  return (
    <TextField
      {...(className ? { className } : {})}
      label={label}
      value={text}
      {...(required ? { required } : {})}
      onChange={(e) => {
        setText(e.target.value);
        if (live) onCommit(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !live) {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}

/** Text that follows `value` when it changes from outside, and can be edited meanwhile. */
function useDraft(value: string) {
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value);
  }
  return [text, setText] as const;
}
