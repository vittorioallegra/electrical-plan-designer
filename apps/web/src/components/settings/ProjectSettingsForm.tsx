import { useTranslation } from 'react-i18next';
import type { ProjectSettings } from '@epd/domain/types';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';

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

/** The project settings fields (heights, slack, waste...); used per project and for the defaults. */
export function ProjectSettingsForm({
  settings,
  readOnly = false,
  edit,
}: {
  settings: ProjectSettings;
  readOnly?: boolean;
  edit: (label: string, fn: (s: ProjectSettings) => void) => unknown;
}) {
  const { t } = useTranslation();
  const row = (f: NumberField) => (
    <label key={f.key} className="contents">
      <span>{t(`settings.${f.key}`)}</span>
      <NumberInput
        aria-label={t(`settings.${f.key}`)}
        value={f.get(settings)}
        unit={f.unit}
        min={f.min}
        max={f.max}
        disabled={readOnly}
        onValueChange={(v) => edit(`setting ${f.key}`, (d) => f.set(d, v))}
      />
    </label>
  );
  const grid = 'grid grid-cols-[1fr_10rem] items-center gap-x-4 gap-y-2';
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-label font-semibold tracking-wide text-text-muted uppercase">
          {t('settings.groupMounting')}
        </h3>
        <div className={grid}>{fields.filter((f) => f.key.startsWith('mounting.')).map(row)}</div>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-label font-semibold tracking-wide text-text-muted uppercase">
          {t('settings.groupRouting')}
        </h3>
        <div className={grid}>
          {fields.filter((f) => !f.key.startsWith('mounting.')).map(row)}
          <label className="contents">
            <span>{t('settings.defaultRunElevation')}</span>
            <Select
              aria-label={t('settings.defaultRunElevation')}
              value={settings.defaultRunElevation}
              disabled={readOnly}
              onValueChange={(v) =>
                edit('setting run elevation', (d) => {
                  d.defaultRunElevation = v as 'floor' | 'ceiling';
                })
              }
              options={[
                { value: 'floor', label: t('runElevation.floor') },
                { value: 'ceiling', label: t('runElevation.ceiling') },
              ]}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
