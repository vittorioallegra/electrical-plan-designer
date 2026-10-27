import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cableColorSchema } from '@epd/domain/schema';
import type { Circuit } from '@epd/domain/types';
import { useCatalog } from '@/hooks/useCatalog';
import { ConductorBadge } from '@/components/ConductorBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PanelSection } from '@/components/ui/PanelSection';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
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

/** Name, type, device, section, conductors, targets and routing of one circuit. */
export function CircuitEditor({ circuit }: { circuit: Circuit }) {
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
    <div data-testid="circuit-editor">
      <PanelSection title={t('circuits.name')}>
        <div className="flex flex-col gap-2">
          <TextField
            key={circuit.id}
            label={t('circuits.name')}
            defaultValue={circuit.name}
            disabled={readOnly}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== circuit.name)
                update('rename circuit', (c) => void (c.name = name));
            }}
          />
          <div className="grid grid-cols-3 gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-small text-text-muted">
              {t('circuits.type')}
              <Select
                value={circuit.type}
                disabled={readOnly}
                onValueChange={(v) =>
                  update('circuit type', (c) => {
                    c.type = v as Circuit['type'];
                    c.crossSection = Math.max(c.crossSection, defaultSectionByType[c.type]);
                  })
                }
                options={circuitTypes.map((type) => ({
                  value: type,
                  label: t(`circuits.types.${type}`),
                }))}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-small text-text-muted">
              {t('circuits.device')}
              <Select
                value={circuit.panelDeviceId}
                disabled={readOnly}
                onValueChange={(v) => update('circuit device', (c) => void (c.panelDeviceId = v))}
                options={devices.map((d) => ({
                  value: d.id,
                  label: d.label || itemName(lookup(d.itemId), d.itemId),
                }))}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-small text-text-muted">
              {t('circuits.section')}
              <Select
                value={String(circuit.crossSection)}
                disabled={readOnly}
                onValueChange={(v) =>
                  update('circuit section', (c) => void (c.crossSection = Number(v)))
                }
                options={sectionOptions}
              />
            </label>
          </div>
        </div>
      </PanelSection>
      <PanelSection title={t('circuits.conductors')}>
        <div className="flex flex-col gap-1">
          {circuit.conductors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <ConductorBadge role={c.role} color={c.color} />
              <Select
                aria-label={t('circuits.conductorColor', { role: c.role })}
                className="ml-auto w-40"
                value={c.color}
                disabled={readOnly}
                onValueChange={(v) =>
                  update(
                    'conductor color',
                    (x) => void (x.conductors[i]!.color = v as typeof c.color),
                  )
                }
                options={colorOptions}
              />
              <IconButton
                label={t('circuits.removeConductor', { role: c.role })}
                icon={<Trash2 size={14} />}
                disabled={readOnly}
                onClick={() => update('remove conductor', (x) => void x.conductors.splice(i, 1))}
              />
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
        </div>
      </PanelSection>
      <PanelSection title={t('circuits.targetsTitle')}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1" data-testid="circuit-targets">
            {circuit.targetNodeIds.length === 0 ? (
              <span className="text-text-muted">{t('circuits.noTargets')}</span>
            ) : null}
            {circuit.targetNodeIds.map((id) => (
              <Badge key={id}>{doc.nodes.find((n) => n.id === id)?.label ?? id}</Badge>
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
        </div>
      </PanelSection>
      <RoutingControls owner={owner} routing={circuit.routing} />
      <div className="p-3">
        <Button
          variant="danger-ghost"
          disabled={readOnly}
          onClick={() => deleteCircuit(store, circuit.id)}
        >
          <Trash2 size={14} />
          {t('circuits.delete')}
        </Button>
      </div>
    </div>
  );
}
