import { Plus, Spline, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { RouteResult } from '@epd/domain/routing';
import { cableColorSchema } from '@epd/domain/schema';
import type { Circuit, ExtraConductorRun, Routing } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useCatalog } from '@/api/catalog';
import { useItemName } from '@/hooks/useItemName';
import { ConductorBadge } from '@/components/ConductorBadge';
import {
  addTwoWayRun,
  createCircuit,
  defaultSectionByType,
  deleteCircuit,
  deleteExtraRun,
  nextCircuitName,
  SECTIONS,
  setRoutingMode,
  updateCircuit,
  updateExtraRun,
} from '@/features/circuits/utils/commands';

const circuitTypes: Circuit['type'][] = ['lighting', 'sockets', 'dedicated', 'other'];
const colors = cableColorSchema.options;

/** Picking happens on the plan canvas: opens the plan when the drawer is used elsewhere. */
function useShowPlan(): () => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id = '' } = useParams();
  return () => {
    const plan = `/projects/${id}/plan`;
    if (id && pathname !== plan) void navigate(plan);
  };
}

function RouteStatus({ route }: { route: RouteResult | undefined }) {
  const { t } = useTranslation();
  if (!route) return null;
  if (!route.ok) {
    return (
      <span className="rounded bg-error-bg px-1 text-error">
        {t(`circuits.problems.${route.problem}`)}
      </span>
    );
  }
  if (route.unreachableTargetIds.length > 0) {
    return (
      <span className="rounded bg-warning-bg px-1 text-warning">
        {t('circuits.unreachable', { count: route.unreachableTargetIds.length })}
      </span>
    );
  }
  return (
    <span className="text-text-muted">
      {t('circuits.routed', { count: route.segmentIds.length })}
    </span>
  );
}

export function CircuitsTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const doc = useEditor((s) => s.data.doc);
  const readOnly = useEditor((s) => s.readOnly);
  const active = useEditor((s) => s.ui.activeOwner);
  const selection = useEditor((s) => s.ui.selection);
  const { routing } = useAnalysis();
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const panel = doc.panels[0];
  const devices = useMemo(() => panel?.devices ?? [], [panel]);
  const deviceLabel = (id: string) => {
    const d = devices.find((x) => x.id === id);
    return d ? d.label || itemName(lookup(d.itemId), d.itemId) : t('circuits.noDevice');
  };
  const selectedBoxes = doc.nodes.filter(
    (n) => selection.includes(n.id) && n.kind === 'terminal_box',
  );

  if (!panel) return <p className="text-text-muted">{t('circuits.noPanel')}</p>;
  const protectiveDevices = devices.filter((d) => {
    const type = lookup(d.itemId)?.attributes.panelDeviceType;
    return type === 'mcb' || type === 'rcbo' || type === 'other';
  });

  return (
    <div className="flex h-full gap-4" data-testid="circuits-tab">
      <div className="flex w-1/2 min-w-0 flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          <Button
            variant="primary"
            disabled={readOnly || devices.length === 0}
            onClick={() =>
              createCircuit(
                store,
                (protectiveDevices[0] ?? devices[0])!.id,
                nextCircuitName(doc, t('circuits.defaultName')),
              )
            }
          >
            <Plus size={14} />
            {t('circuits.new')}
          </Button>
          <Button
            disabled={readOnly || selectedBoxes.length !== 2}
            title={t('circuits.twoWayHint')}
            onClick={() => addTwoWayRun(store, selectedBoxes[0]!.id, selectedBoxes[1]!.id)}
          >
            <Spline size={14} />
            {t('circuits.twoWay')}
          </Button>
        </div>
        {devices.length === 0 ? <p className="text-text-muted">{t('circuits.noDevices')}</p> : null}
        <ul className="divide-y divide-border" aria-label={t('editor.tabs.circuits')}>
          {doc.circuits.map((c) => (
            <li key={c.id}>
              <button
                className={cn(
                  'flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-1 py-1 text-left',
                  active?.id === c.id && 'bg-surface-muted',
                )}
                aria-pressed={active?.id === c.id}
                onClick={() =>
                  store.getState().setUi({ activeOwner: { kind: 'circuit', id: c.id }, pick: null })
                }
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-text-muted">{deviceLabel(c.panelDeviceId)}</span>
                <span className="tabular-nums">
                  {t('units.mm2', { value: formatNumber(c.crossSection, locale) })}
                </span>
                <span className="text-text-muted">
                  {t('circuits.targets', { count: c.targetNodeIds.length })}
                </span>
                <RouteStatus route={routing.circuitRoutes.get(c.id)} />
              </button>
            </li>
          ))}
          {doc.extraRuns.map((r) => (
            <li key={r.id}>
              <button
                className={cn(
                  'flex w-full flex-wrap items-center gap-x-3 px-1 py-1 text-left',
                  active?.id === r.id && 'bg-surface-muted',
                )}
                aria-pressed={active?.id === r.id}
                onClick={() =>
                  store.getState().setUi({ activeOwner: { kind: 'extra', id: r.id }, pick: null })
                }
              >
                <span className="font-medium">{t('circuits.extraRun')}</span>
                <span className="text-text-muted">
                  {t('inspector.segment.ends', {
                    from: doc.nodes.find((n) => n.id === r.fromNodeId)?.label ?? '?',
                    to: doc.nodes.find((n) => n.id === r.toNodeId)?.label ?? '?',
                  })}
                </span>
                <RouteStatus route={routing.extraRunRoutes.get(r.id)} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="w-1/2 min-w-0 overflow-y-auto border-l border-border pl-3">
        {active?.kind === 'circuit' && doc.circuits.some((c) => c.id === active.id) ? (
          <CircuitEditor circuit={doc.circuits.find((c) => c.id === active.id)!} />
        ) : active?.kind === 'extra' && doc.extraRuns.some((r) => r.id === active.id) ? (
          <ExtraRunEditor run={doc.extraRuns.find((r) => r.id === active.id)!} />
        ) : (
          <p className="text-text-muted">{t('circuits.selectHint')}</p>
        )}
      </div>
    </div>
  );
}

function RoutingControls({
  owner,
  routing,
}: {
  owner: { kind: 'circuit' | 'extra'; id: string };
  routing: Routing;
}) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const pick = useEditor((s) => s.ui.pick);
  const analysis = useAnalysis();
  const route =
    owner.kind === 'circuit'
      ? analysis.routing.circuitRoutes.get(owner.id)
      : analysis.routing.extraRunRoutes.get(owner.id);
  const pickingRoute = pick?.mode === 'route' && pick.owner.id === owner.id;
  const showPlan = useShowPlan();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-medium">{t('circuits.routing')}</legend>
      <div className="flex gap-3">
        {(['auto', 'manual'] as const).map((mode) => (
          <label key={mode} className="flex items-center gap-1">
            <input
              type="radio"
              name={`routing-${owner.id}`}
              checked={routing.mode === mode}
              disabled={readOnly}
              onChange={() => {
                setRoutingMode(store, owner, mode, analysis.routing);
                if (mode === 'auto' && pickingRoute) store.getState().setUi({ pick: null });
              }}
            />
            {t(`circuits.mode.${mode}`)}
          </label>
        ))}
      </div>
      {routing.mode === 'manual' ? (
        <Button
          variant={pickingRoute ? 'primary' : 'secondary'}
          disabled={readOnly}
          onClick={() => {
            if (!pickingRoute) showPlan();
            store.getState().setUi({
              pick: pickingRoute ? null : { mode: 'route', owner },
              activeOwner: owner,
              tool: 'select',
            });
          }}
        >
          {pickingRoute ? t('circuits.doneEditingRoute') : t('circuits.editRoute')}
        </Button>
      ) : null}
      <p data-testid="route-status">
        <RouteStatus route={route} />
      </p>
    </fieldset>
  );
}

function CircuitEditor({ circuit }: { circuit: Circuit }) {
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
      <Button variant="danger" disabled={readOnly} onClick={() => deleteCircuit(store, circuit.id)}>
        <Trash2 size={14} />
        {t('circuits.delete')}
      </Button>
    </div>
  );
}

function ExtraRunEditor({ run }: { run: ExtraConductorRun }) {
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
      <Button variant="danger" disabled={readOnly} onClick={() => deleteExtraRun(store, run.id)}>
        <Trash2 size={14} />
        {t('circuits.deleteRun')}
      </Button>
    </div>
  );
}
