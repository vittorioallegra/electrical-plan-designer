import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { polylineLength } from '@epd/domain/geometry';
import { createLengthContext } from '@epd/domain/lengths';
import type { ConduitSegment, RunElevation } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { PanelSection } from '@/components/ui/PanelSection';
import { Select } from '@/components/ui/Select';
import { formatLength, formatNumber } from '@/lib/format';
import { useItemName } from '@/hooks/useItemName';
import { useItemsOf } from '@/hooks/useItemsOf';
import { useAnalysis } from '@/hooks/useAnalysis';
import { ConductorBadge } from '@/components/ConductorBadge';

const elevations: RunElevation[] = ['floor', 'ceiling', 'direct'];

export function SegmentInspector({
  segment,
  onDelete,
}: {
  segment: ConduitSegment;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  const settings = useEditor((s) => s.data.settings);
  const conduits = useItemsOf('conduit');
  const itemName = useItemName();
  const ctx = createLengthContext(doc, settings);
  const { routing } = useAnalysis();
  const conductors = routing.occupancy.get(segment.id) ?? [];
  const ownerName = (o: { kind: string; id: string }) =>
    o.kind === 'circuit'
      ? (doc.circuits.find((c) => c.id === o.id)?.name ?? o.id)
      : t('circuits.extraRun');
  const from = doc.nodes.find((n) => n.id === segment.fromNodeId);
  const to = doc.nodes.find((n) => n.id === segment.toNodeId);
  const riser = ctx.isRiser(segment);
  const plan =
    from && to && !riser ? polylineLength([from.position, ...segment.vertices, to.position]) : 0;
  const update = (label: string, fn: (s: ConduitSegment) => void) =>
    store.getState().applyCommand(label, (d) => {
      const s = d.doc.segments.find((x) => x.id === segment.id);
      if (s) fn(s);
    });
  return (
    <div data-testid="segment-inspector">
      <PanelSection title={t(riser ? 'inspector.segment.riserTitle' : 'inspector.segment.title')}>
        <div className="flex flex-col gap-2">
          <p className="text-text-muted">
            {t('inspector.segment.ends', { from: from?.label ?? '?', to: to?.label ?? '?' })}
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2">
            <dt>{t('inspector.segment.total')}</dt>
            <dd className="font-mono tabular-nums" data-testid="segment-length">
              {formatLength(ctx.segmentLengthMm(segment) / 1000, locale)}
            </dd>
            {!riser ? (
              <>
                <dt>{t('inspector.segment.plan')}</dt>
                <dd className="font-mono tabular-nums">{formatLength(plan, locale)}</dd>
              </>
            ) : null}
          </dl>
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t('inspector.segment.conduit')}
            <Select
              value={segment.conduitItemId}
              disabled={readOnly}
              onValueChange={(v) => update('conduit item', (s) => void (s.conduitItemId = v))}
              options={conduits.map((c) => ({ value: c.id, label: itemName(c) }))}
            />
          </label>
          {!riser ? (
            <label className="flex flex-col gap-1 text-small text-text-muted">
              {t('inspector.segment.runElevation')}
              <Select
                value={segment.runElevation}
                disabled={readOnly}
                onValueChange={(v) =>
                  update('run elevation', (s) => void (s.runElevation = v as RunElevation))
                }
                options={elevations.map((el) => ({ value: el, label: t(`runElevation.${el}`) }))}
              />
            </label>
          ) : null}
        </div>
      </PanelSection>
      <div data-testid="segment-occupancy">
        <PanelSection title={t('inspector.segment.occupancy', { count: conductors.length })}>
          <div className="flex flex-col gap-1">
            {conductors.length === 0 ? (
              <span className="text-text-muted">{t('inspector.segment.empty')}</span>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {conductors.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2">
                  <ConductorBadge role={c.role} color={c.color} />
                  <span className="font-mono text-text-muted tabular-nums">
                    {t('units.mm2', { value: formatNumber(c.crossSection, locale) })}
                  </span>
                  <span className="text-text-muted">{ownerName(c.owner)}</span>
                </li>
              ))}
            </ul>
          </div>
        </PanelSection>
      </div>
      <div className="p-3">
        <Button variant="danger-ghost" disabled={readOnly} onClick={onDelete}>
          <Trash2 size={16} />
          {t('inspector.delete')}
        </Button>
      </div>
    </div>
  );
}
