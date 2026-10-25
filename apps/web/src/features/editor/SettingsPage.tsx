import { useTranslation } from 'react-i18next';
import type { ProjectSettings } from '@/domain/types';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import { NumberInput } from '@/ui/NumberInput';

type NumberField = {
  key: string;
  unit: string;
  min: number;
  max: number;
  get: (s: ProjectSettings) => number;
  set: (s: ProjectSettings, v: number) => void;
};

const heightField = (k: keyof ProjectSettings['mountingHeights']): NumberField => ({
  key: `mounting.${k}`,
  unit: 'm',
  min: 0,
  max: 10,
  get: (s) => s.mountingHeights[k],
  set: (s, v) => {
    s.mountingHeights[k] = v;
  },
});

const fields: NumberField[] = [
  heightField('socket'),
  heightField('switch'),
  heightField('junctionBox'),
  heightField('panel'),
  {
    key: 'defaultFloorHeight',
    unit: 'm',
    min: 0.5,
    max: 20,
    get: (s) => s.defaultFloorHeight,
    set: (s, v) => void (s.defaultFloorHeight = v),
  },
  {
    key: 'terminationSlack',
    unit: 'm',
    min: 0,
    max: 5,
    get: (s) => s.terminationSlack,
    set: (s, v) => void (s.terminationSlack = v),
  },
  {
    key: 'wastePercent',
    unit: '%',
    min: 0,
    max: 100,
    get: (s) => s.wastePercent,
    set: (s, v) => void (s.wastePercent = v),
  },
  {
    key: 'conduitFillFactor',
    unit: '×',
    min: 1,
    max: 5,
    get: (s) => s.conduitFillFactor,
    set: (s, v) => void (s.conduitFillFactor = v),
  },
];

/** Per-project settings; every change is an undoable command. */
export function SettingsPage() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const settings = useEditor((s) => s.data.settings);
  const readOnly = useEditor((s) => s.readOnly);
  const apply = store.getState().applyCommand;
  return (
    <div className="mx-auto max-w-xl overflow-y-auto p-4">
      <h1 className="mb-1 text-xl font-semibold">{t('pages.settings')}</h1>
      <p className="mb-4 text-text-muted">{t('settings.hint')}</p>
      <div className="grid grid-cols-[1fr_10rem] items-center gap-x-4 gap-y-2">
        {fields.map((f) => (
          <label key={f.key} className="contents">
            <span>{t(`settings.${f.key}`)}</span>
            <NumberInput
              aria-label={t(`settings.${f.key}`)}
              value={f.get(settings)}
              unit={f.unit}
              min={f.min}
              max={f.max}
              disabled={readOnly}
              onValueChange={(v) => apply(`setting ${f.key}`, (d) => f.set(d.settings, v))}
            />
          </label>
        ))}
        <label className="contents">
          <span>{t('settings.defaultRunElevation')}</span>
          <select
            className="h-[var(--control-height)] rounded border border-border px-2"
            value={settings.defaultRunElevation}
            disabled={readOnly}
            onChange={(e) =>
              apply('setting run elevation', (d) => {
                d.settings.defaultRunElevation = e.target.value as 'floor' | 'ceiling';
              })
            }
          >
            <option value="floor">{t('runElevation.floor')}</option>
            <option value="ceiling">{t('runElevation.ceiling')}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
