import { Plus, Spline } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '@/hooks/useCatalog';
import type { Circuit, ExtraConductorRun } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table } from '@/components/ui/Table';
import { Toolbar } from '@/components/ui/Toolbar';
import { addTwoWayRun, createCircuit, nextCircuitName } from '@/features/circuits/utils/commands';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useItemName } from '@/hooks/useItemName';
import { formatNumber } from '@/lib/format';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { CircuitEditor } from './CircuitEditor';
import { ExtraRunEditor } from './ExtraRunEditor';
import { RouteStatus } from './RouteStatus';

type Row =
  | { kind: 'circuit'; id: string; circuit: Circuit }
  | { kind: 'extra'; id: string; run: ExtraConductorRun };

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

  if (!panel) return <EmptyState message={t('circuits.noPanel')} />;
  const protectiveDevices = devices.filter((d) => {
    const type = lookup(d.itemId)?.attributes.panelDeviceType;
    return type === 'mcb' || type === 'rcbo' || type === 'other';
  });

  const rows: Row[] = [
    ...doc.circuits.map((circuit): Row => ({ kind: 'circuit', id: circuit.id, circuit })),
    ...doc.extraRuns.map((run): Row => ({ kind: 'extra', id: run.id, run })),
  ];
  const nodeLabel = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? '?';

  return (
    <div className="flex h-full" data-testid="circuits-tab">
      <div className="flex w-1/2 min-w-0 flex-col">
        <Toolbar aria-label={t('editor.tabs.circuits')}>
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
        </Toolbar>
        {devices.length === 0 ? (
          <p className="pb-2 text-text-muted">{t('circuits.noDevices')}</p>
        ) : null}
        <Table<Row>
          rowKey={(r) => r.id}
          rows={rows}
          selectedKey={active?.id ?? null}
          onRowClick={(r) =>
            store.getState().setUi({ activeOwner: { kind: r.kind, id: r.id }, pick: null })
          }
          columns={[
            {
              key: 'name',
              header: t('circuits.name'),
              cell: (r) => (
                <span className="font-medium">
                  {r.kind === 'circuit' ? r.circuit.name : t('circuits.extraRun')}
                </span>
              ),
            },
            {
              key: 'device',
              header: t('circuits.device'),
              cell: (r) =>
                r.kind === 'circuit' ? (
                  <span className="text-text-muted">{deviceLabel(r.circuit.panelDeviceId)}</span>
                ) : (
                  <span className="text-text-muted">
                    {t('inspector.segment.ends', {
                      from: nodeLabel(r.run.fromNodeId),
                      to: nodeLabel(r.run.toNodeId),
                    })}
                  </span>
                ),
            },
            {
              key: 'section',
              header: t('circuits.section'),
              align: 'right',
              cell: (r) =>
                r.kind === 'circuit'
                  ? t('units.mm2', { value: formatNumber(r.circuit.crossSection, locale) })
                  : '',
            },
            {
              key: 'targets',
              header: t('circuits.targetsTitle'),
              cell: (r) =>
                r.kind === 'circuit' ? (
                  <span className="text-text-muted">
                    {t('circuits.targets', { count: r.circuit.targetNodeIds.length })}
                  </span>
                ) : null,
            },
            {
              key: 'status',
              header: t('circuits.routing'),
              cell: (r) => (
                <RouteStatus
                  route={
                    r.kind === 'circuit'
                      ? routing.circuitRoutes.get(r.id)
                      : routing.extraRunRoutes.get(r.id)
                  }
                />
              ),
            },
          ]}
        />
      </div>
      <div className="w-1/2 min-w-0 overflow-y-auto border-l border-border">
        {active?.kind === 'circuit' && doc.circuits.some((c) => c.id === active.id) ? (
          <CircuitEditor circuit={doc.circuits.find((c) => c.id === active.id)!} />
        ) : active?.kind === 'extra' && doc.extraRuns.some((r) => r.id === active.id) ? (
          <ExtraRunEditor run={doc.extraRuns.find((r) => r.id === active.id)!} />
        ) : (
          <EmptyState message={t('circuits.selectHint')} />
        )}
      </div>
    </div>
  );
}
