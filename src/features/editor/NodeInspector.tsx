import { ArrowDown, ArrowUp, Link2Off, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { linkRiser, unlinkRiser } from '@/domain/edits';
import { newId } from '@/domain/ids';
import { createLengthContext } from '@/domain/lengths';
import type { Mounting, PlanNode } from '@/domain/types';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import { Button } from '@/ui/Button';
import { formatLength } from '@/ui/format';
import { NumberInput } from '@/ui/NumberInput';
import { useItemName, useItemsOf } from '../catalog/useCatalog';

const mountings: Mounting[] = ['socket', 'switch', 'ceiling', 'custom'];

export function NodeInspector({ node, onDelete }: { node: PlanNode; onDelete: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  const settings = useEditor((s) => s.data.settings);
  const itemName = useItemName();
  const boxes = useItemsOf(node.kind === 'junction_box' ? 'junction_box' : 'box');
  const height = createLengthContext(doc, settings).nodeHeightMm(node.id) / 1000;
  const update = (label: string, fn: (n: PlanNode) => void) =>
    store.getState().applyCommand(label, (d) => {
      const n = d.doc.nodes.find((x) => x.id === node.id);
      if (n) fn(n);
    });

  const floors = [...doc.floors].sort((a, b) => a.order - b.order);
  const floorIndex = floors.findIndex((f) => f.id === node.floorId);
  const groupFloors = new Set(
    doc.nodes
      .filter(
        (n) => n.kind === 'riser_point' && n.riserGroupId === node.riserGroupId && n.id !== node.id,
      )
      .map((n) => n.floorId),
  );

  return (
    <div className="flex flex-col gap-2" data-testid="node-inspector">
      <h2 className="font-medium">{t(`nodeKind.${node.kind}`)}</h2>
      <label className="flex flex-col gap-1">
        {t('inspector.node.label')}
        <input
          key={node.id}
          className="h-[var(--control-height)] rounded border border-border px-2"
          defaultValue={node.label}
          disabled={readOnly}
          onBlur={(e) => {
            const label = e.target.value.trim();
            if (label !== node.label) update('rename node', (n) => void (n.label = label));
          }}
        />
      </label>
      <div className="grid grid-cols-2 gap-1">
        <NumberInput
          aria-label={t('inspector.node.x')}
          value={node.position.x}
          unit="m"
          disabled={readOnly}
          onValueChange={(x) =>
            update('move node', (n) => void (n.position = { ...n.position, x }))
          }
        />
        <NumberInput
          aria-label={t('inspector.node.y')}
          value={node.position.y}
          unit="m"
          disabled={readOnly}
          onValueChange={(y) =>
            update('move node', (n) => void (n.position = { ...n.position, y }))
          }
        />
      </div>

      {node.kind === 'terminal_box' ? (
        <>
          <label className="flex flex-col gap-1">
            {t('inspector.node.mounting')}
            <select
              className="h-[var(--control-height)] rounded border border-border px-2"
              value={node.mounting ?? 'socket'}
              disabled={readOnly}
              onChange={(e) =>
                update('mounting', (n) => void (n.mounting = e.target.value as Mounting))
              }
            >
              {mountings.map((m) => (
                <option key={m} value={m}>
                  {t(`mounting.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={node.status === 'provision'}
              disabled={readOnly}
              onChange={(e) =>
                update(
                  'provision',
                  (n) => void (n.status = e.target.checked ? 'provision' : 'active'),
                )
              }
            />
            {t('inspector.node.provision')}
          </label>
        </>
      ) : null}

      {node.kind !== 'riser_point' ? (
        <label className="flex flex-col gap-1">
          {t('inspector.node.customHeight')}
          <div className="flex gap-1">
            <NumberInput
              aria-label={t('inspector.node.customHeight')}
              value={node.customHeight ?? null}
              placeholder={formatLength(height, locale)}
              unit="m"
              min={0}
              max={20}
              disabled={readOnly}
              onValueChange={(v) => update('custom height', (n) => void (n.customHeight = v))}
            />
            {node.customHeight !== undefined ? (
              <Button
                variant="ghost"
                disabled={readOnly}
                onClick={() => update('default height', (n) => void delete n.customHeight)}
              >
                {t('inspector.node.useDefault')}
              </Button>
            ) : null}
          </div>
          <span className="text-text-muted">
            {t('inspector.node.heightValue', { height: formatLength(height, locale) })}
          </span>
        </label>
      ) : null}

      {node.kind === 'terminal_box' || node.kind === 'junction_box' ? (
        <label className="flex flex-col gap-1">
          {t('inspector.node.boxItem')}
          <select
            className="h-[var(--control-height)] rounded border border-border px-2"
            value={node.boxItemId ?? ''}
            disabled={readOnly}
            onChange={(e) =>
              update('box item', (n) => {
                if (e.target.value) n.boxItemId = e.target.value;
                else delete n.boxItemId;
              })
            }
          >
            <option value="">{t('inspector.node.noBox')}</option>
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {itemName(b)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {node.kind === 'riser_point' ? (
        <div className="flex flex-col gap-1" data-testid="riser-links">
          <span>{t('inspector.riser.title')}</span>
          {(['up', 'down'] as const).map((dir) => {
            const target = floors[floorIndex + (dir === 'up' ? 1 : -1)];
            if (!target) return null;
            const linked = groupFloors.has(target.id);
            return (
              <Button
                key={dir}
                disabled={readOnly || linked}
                onClick={() =>
                  store
                    .getState()
                    .applyCommand('link riser', (d) => void linkRiser(d.doc, node.id, dir, newId))
                }
              >
                {dir === 'up' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                {linked
                  ? t('inspector.riser.linked', { floor: target.name })
                  : t('inspector.riser.link', { floor: target.name })}
              </Button>
            );
          })}
          {groupFloors.size > 0 ? (
            <Button
              variant="ghost"
              disabled={readOnly}
              onClick={() =>
                store
                  .getState()
                  .applyCommand('unlink riser', (d) => void unlinkRiser(d.doc, node.id, newId))
              }
            >
              <Link2Off size={16} />
              {t('inspector.riser.unlink')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Button variant="danger" disabled={readOnly} onClick={onDelete}>
        <Trash2 size={16} />
        {t('inspector.delete')}
      </Button>
    </div>
  );
}
