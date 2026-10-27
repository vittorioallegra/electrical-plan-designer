import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cableColorSchema } from '@epd/domain/schema';
import type { ExtraConductorRun } from '@epd/domain/types';
import { ConductorBadge } from '@/components/ConductorBadge';
import { Button } from '@/components/ui/Button';
import { deleteExtraRun, SECTIONS, updateExtraRun } from '@/features/circuits/utils/commands';
import { formatNumber } from '@/lib/format';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { RoutingControls } from './RoutingControls';

const colors = cableColorSchema.options;

/** Circuit, conductors and routing of an extra conductor run (e.g. two-way travelers). */
export function ExtraRunEditor({ run }: { run: ExtraConductorRun }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  const update = (label: string, fn: (r: ExtraConductorRun) => void) =>
    updateExtraRun(store, run.id, label, fn);
  const label = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <div className="flex flex-col gap-2" data-testid="extra-run-editor">
      <h3 className="font-medium">
        {t('circuits.extraRunTitle', { from: label(run.fromNodeId), to: label(run.toNodeId) })}
      </h3>
      <label className="flex flex-col gap-1">
        {t('circuits.belongsTo')}
        <select
          className="h-[var(--control-height)] rounded border border-border px-1"
          value={run.circuitId ?? ''}
          disabled={readOnly}
          onChange={(e) =>
            update('extra run circuit', (r) => {
              if (e.target.value) r.circuitId = e.target.value;
              else delete r.circuitId;
            })
          }
        >
          <option value="">{t('circuits.noCircuit')}</option>
          {doc.circuits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">{t('circuits.conductors')}</legend>
        {run.conductors.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1">
            <ConductorBadge role={c.role} color={c.color} />
            <select
              aria-label={t('circuits.conductorSection', { n: i + 1 })}
              className="ml-auto h-7 rounded border border-border px-1"
              value={c.crossSection}
              disabled={readOnly}
              onChange={(e) =>
                update(
                  'conductor section',
                  (r) => void (r.conductors[i]!.crossSection = Number(e.target.value)),
                )
              }
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {t('units.mm2', { value: formatNumber(s, locale) })}
                </option>
              ))}
            </select>
            <select
              aria-label={t('circuits.conductorColor', { role: c.role })}
              className="h-7 rounded border border-border px-1"
              value={c.color}
              disabled={readOnly}
              onChange={(e) =>
                update(
                  'conductor color',
                  (r) => void (r.conductors[i]!.color = e.target.value as typeof c.color),
                )
              }
            >
              {colors.map((color) => (
                <option key={color} value={color}>
                  {t(`colors.${color}`)}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              aria-label={t('circuits.removeConductor', { role: c.role })}
              disabled={readOnly}
              onClick={() => update('remove conductor', (r) => void r.conductors.splice(i, 1))}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <div className="flex gap-1">
          {(['traveler', 'return', 'other'] as const).map((role) => (
            <Button
              key={role}
              variant="ghost"
              disabled={readOnly}
              onClick={() =>
                update(
                  'add conductor',
                  (r) => void r.conductors.push({ role, crossSection: 1.5, color: 'black' }),
                )
              }
            >
              <Plus size={14} />
              {t(`conductorRoles.${role}`)}
            </Button>
          ))}
        </div>
      </fieldset>
      <RoutingControls owner={{ kind: 'extra', id: run.id }} routing={run.routing} />
      <Button
        variant="danger-ghost"
        disabled={readOnly}
        onClick={() => deleteExtraRun(store, run.id)}
      >
        <Trash2 size={14} />
        {t('circuits.deleteRun')}
      </Button>
    </div>
  );
}
