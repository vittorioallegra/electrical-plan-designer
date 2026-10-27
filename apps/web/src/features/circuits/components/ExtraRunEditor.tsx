import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cableColorSchema } from '@epd/domain/schema';
import type { ExtraConductorRun } from '@epd/domain/types';
import { ConductorBadge } from '@/components/ConductorBadge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PanelSection } from '@/components/ui/PanelSection';
import { Select } from '@/components/ui/Select';
import { deleteExtraRun, SECTIONS, updateExtraRun } from '@/features/circuits/utils/commands';
import { formatNumber } from '@/lib/format';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { RoutingControls } from './RoutingControls';

/** Circuit, conductors and routing of an extra conductor run (e.g. two-way travelers). */
export function ExtraRunEditor({ run }: { run: ExtraConductorRun }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const sectionOptions = SECTIONS.map((s) => ({
    value: String(s),
    label: t('units.mm2', { value: formatNumber(s, locale) }),
  }));
  const colorOptions = cableColorSchema.options.map((color) => ({
    value: color,
    label: t(`colors.${color}`),
  }));
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  const update = (label: string, fn: (r: ExtraConductorRun) => void) =>
    updateExtraRun(store, run.id, label, fn);
  const label = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <div data-testid="extra-run-editor">
      <PanelSection
        title={t('circuits.extraRunTitle', {
          from: label(run.fromNodeId),
          to: label(run.toNodeId),
        })}
      >
        <label className="flex flex-col gap-1 text-small text-text-muted">
          {t('circuits.belongsTo')}
          <Select
            value={run.circuitId ?? ''}
            disabled={readOnly}
            onValueChange={(v) =>
              update('extra run circuit', (r) => {
                if (v) r.circuitId = v;
                else delete r.circuitId;
              })
            }
            options={[
              { value: '', label: t('circuits.noCircuit') },
              ...doc.circuits.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </label>
      </PanelSection>
      <PanelSection title={t('circuits.conductors')}>
        <div className="flex flex-col gap-1">
          {run.conductors.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1">
              <ConductorBadge role={c.role} color={c.color} />
              <Select
                aria-label={t('circuits.conductorSection', { n: i + 1 })}
                className="ml-auto w-28"
                value={String(c.crossSection)}
                disabled={readOnly}
                onValueChange={(v) =>
                  update(
                    'conductor section',
                    (r) => void (r.conductors[i]!.crossSection = Number(v)),
                  )
                }
                options={sectionOptions}
              />
              <Select
                aria-label={t('circuits.conductorColor', { role: c.role })}
                className="w-36"
                value={c.color}
                disabled={readOnly}
                onValueChange={(v) =>
                  update(
                    'conductor color',
                    (r) => void (r.conductors[i]!.color = v as typeof c.color),
                  )
                }
                options={colorOptions}
              />
              <IconButton
                label={t('circuits.removeConductor', { role: c.role })}
                icon={<Trash2 size={14} />}
                disabled={readOnly}
                onClick={() => update('remove conductor', (r) => void r.conductors.splice(i, 1))}
              />
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
        </div>
      </PanelSection>
      <RoutingControls owner={{ kind: 'extra', id: run.id }} routing={run.routing} />
      <div className="p-3">
        <Button
          variant="danger-ghost"
          disabled={readOnly}
          onClick={() => deleteExtraRun(store, run.id)}
        >
          <Trash2 size={14} />
          {t('circuits.deleteRun')}
        </Button>
      </div>
    </div>
  );
}
