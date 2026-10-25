import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { polylineLength } from '@epd/domain/geometry';
import { createLengthContext } from '@epd/domain/lengths';
import type { ConduitSegment, RunElevation } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { formatLength, formatNumber } from '@/lib/format';
import { useItemName, useItemsOf } from '@/features/catalog/hooks/useCatalog';
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
    <div className="flex flex-col gap-2" data-testid="segment-inspector">
      <h2 className="font-medium">
        {t(riser ? 'inspector.segment.riserTitle' : 'inspector.segment.title')}
      </h2>
      <p className="text-text-muted">
        {t('inspector.segment.ends', { from: from?.label ?? '?', to: to?.label ?? '?' })}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2">
        <dt>{t('inspector.segment.total')}</dt>
        <dd className="tabular-nums" data-testid="segment-length">
          {formatLength(ctx.segmentLengthMm(segment) / 1000, locale)}
        </dd>
        {!riser ? (
          <>
            <dt>{t('inspector.segment.plan')}</dt>
            <dd className="tabular-nums">{formatLength(plan, locale)}</dd>
          </>
        ) : null}
      </dl>
      <label className="flex flex-col gap-1">
        {t('inspector.segment.conduit')}
        <select
          className="h-[var(--control-height)] rounded border border-border px-2"
          value={segment.conduitItemId}
          disabled={readOnly}
          onChange={(e) => update('conduit item', (s) => void (s.conduitItemId = e.target.value))}
        >
          {conduits.map((c) => (
            <option key={c.id} value={c.id}>
              {itemName(c)}
            </option>
          ))}
        </select>
      </label>
      {!riser ? (
        <label className="flex flex-col gap-1">
          {t('inspector.segment.runElevation')}
          <select
            className="h-[var(--control-height)] rounded border border-border px-2"
            value={segment.runElevation}
            disabled={readOnly}
            onChange={(e) =>
              update('run elevation', (s) => void (s.runElevation = e.target.value as RunElevation))
            }
          >
            {elevations.map((el) => (
              <option key={el} value={el}>
                {t(`runElevation.${el}`)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex flex-col gap-1" data-testid="segment-occupancy">
        <span className="font-medium">
          {t('inspector.segment.occupancy', { count: conductors.length })}
        </span>
        {conductors.length === 0 ? (
          <span className="text-text-muted">{t('inspector.segment.empty')}</span>
        ) : null}
        <ul className="flex flex-col gap-0.5">
          {conductors.map((c, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-2">
              <ConductorBadge role={c.role} color={c.color} />
              <span className="tabular-nums text-text-muted">
                {t('units.mm2', { value: formatNumber(c.crossSection, locale) })}
              </span>
              <span className="text-text-muted">{ownerName(c.owner)}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button variant="danger" disabled={readOnly} onClick={onDelete}>
        <Trash2 size={16} />
        {t('inspector.delete')}
      </Button>
    </div>
  );
}
