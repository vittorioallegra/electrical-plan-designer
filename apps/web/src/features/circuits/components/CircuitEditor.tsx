import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cableColorSchema } from '@epd/domain/schema';
import type { Circuit } from '@epd/domain/types';
import { useCatalog } from '@/hooks/useCatalog';
import { ConductorBadge } from '@/components/ConductorBadge';
import { Button } from '@/components/ui/Button';
import { useShowPlan } from '@/features/circuits/hooks/useShowPlan';
import {
  defaultSectionByType,
  deleteCircuit,
  SECTIONS,
  updateCircuit,
} from '@/features/circuits/utils/commands';
import { useItemName } from '@/hooks/useItemName';
import { formatNumber } from '@/lib/format';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { RoutingControls } from './RoutingControls';

const circuitTypes: Circuit['type'][] = ['lighting', 'sockets', 'dedicated', 'other'];
const colors = cableColorSchema.options;

/** Name, type, device, section, conductors, targets and routing of one circuit. */
export function CircuitEditor({ circuit }: { circuit: Circuit }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const showPlan = useShowPlan();
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  const pick = useEditor((s) => s.ui.pick);
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const devices = doc.panels[0]?.devices ?? [];
  const update = (label: string, fn: (c: Circuit) => void) =>
    updateCircuit(store, circuit.id, label, fn);
  const picking = pick?.mode === 'targets' && pick.owner.id === circuit.id;
  const owner = { kind: 'circuit' as const, id: circuit.id };
  return (
    <div className="flex flex-col gap-2" data-testid="circuit-editor">
      <label className="flex flex-col gap-1">
        {t('circuits.name')}
        <input
          key={circuit.id}
          className="h-[var(--control-height)] rounded border border-border px-2"
          defaultValue={circuit.name}
          disabled={readOnly}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== circuit.name)
              update('rename circuit', (c) => void (c.name = name));
          }}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          {t('circuits.type')}
          <select
            className="h-[var(--control-height)] rounded border border-border px-1"
            value={circuit.type}
            disabled={readOnly}
            onChange={(e) =>
              update('circuit type', (c) => {
                c.type = e.target.value as Circuit['type'];
                c.crossSection = Math.max(c.crossSection, defaultSectionByType[c.type]);
              })
            }
          >
            {circuitTypes.map((type) => (
              <option key={type} value={type}>
                {t(`circuits.types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('circuits.device')}
          <select
            className="h-[var(--control-height)] rounded border border-border px-1"
            value={circuit.panelDeviceId}
            disabled={readOnly}
            onChange={(e) =>
              update('circuit device', (c) => void (c.panelDeviceId = e.target.value))
            }
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label || itemName(lookup(d.itemId), d.itemId)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('circuits.section')}
          <select
            className="h-[var(--control-height)] rounded border border-border px-1"
            value={circuit.crossSection}
            disabled={readOnly}
            onChange={(e) =>
              update('circuit section', (c) => void (c.crossSection = Number(e.target.value)))
            }
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {t('units.mm2', { value: formatNumber(s, locale) })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">{t('circuits.conductors')}</legend>
        {circuit.conductors.map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <ConductorBadge role={c.role} color={c.color} />
            <select
              aria-label={t('circuits.conductorColor', { role: c.role })}
              className="ml-auto h-7 rounded border border-border px-1"
              value={c.color}
              disabled={readOnly}
              onChange={(e) =>
                update(
                  'conductor color',
                  (x) => void (x.conductors[i]!.color = e.target.value as typeof c.color),
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
              onClick={() => update('remove conductor', (x) => void x.conductors.splice(i, 1))}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <div className="flex gap-1">
          {(['L', 'N', 'PE'] as const).map((role) => (
            <Button
              key={role}
              variant="ghost"
              disabled={readOnly}
              onClick={() =>
                update(
                  'add conductor',
                  (x) =>
                    void x.conductors.push({
                      role,
                      color: role === 'L' ? 'brown' : role === 'N' ? 'blue' : 'yellow_green',
                    }),
                )
              }
            >
              <Plus size={14} />
              {t(`conductorRoles.${role}`)}
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">{t('circuits.targetsTitle')}</legend>
        <div className="flex flex-wrap gap-1" data-testid="circuit-targets">
          {circuit.targetNodeIds.length === 0 ? (
            <span className="text-text-muted">{t('circuits.noTargets')}</span>
          ) : null}
          {circuit.targetNodeIds.map((id) => (
            <span key={id} className="rounded bg-surface-muted px-1.5">
              {doc.nodes.find((n) => n.id === id)?.label ?? id}
            </span>
          ))}
        </div>
        <Button
          variant={picking ? 'primary' : 'secondary'}
          disabled={readOnly}
          onClick={() => {
            if (!picking) showPlan();
            store.getState().setUi({
              pick: picking ? null : { mode: 'targets', owner },
              activeOwner: owner,
              tool: 'select',
            });
          }}
        >
          {picking ? t('circuits.donePicking') : t('circuits.pickTargets')}
        </Button>
      </fieldset>
      <RoutingControls owner={owner} routing={circuit.routing} />
      <Button
        variant="danger-ghost"
        disabled={readOnly}
        onClick={() => deleteCircuit(store, circuit.id)}
      >
        <Trash2 size={14} />
        {t('circuits.delete')}
      </Button>
    </div>
  );
}
