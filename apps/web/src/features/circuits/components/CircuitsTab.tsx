import { Plus, Spline } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '@/hooks/useCatalog';
import { Button } from '@/components/ui/Button';
import { addTwoWayRun, createCircuit, nextCircuitName } from '@/features/circuits/utils/commands';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useItemName } from '@/hooks/useItemName';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { CircuitEditor } from './CircuitEditor';
import { ExtraRunEditor } from './ExtraRunEditor';
import { RouteStatus } from './RouteStatus';

/** Circuits and extra runs of the project (list), with the editor of the active one. */
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
