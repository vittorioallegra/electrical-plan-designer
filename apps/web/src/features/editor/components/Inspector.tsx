import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { distance } from '@epd/domain/geometry';
import type { Wall } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { formatLength } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { NumberInput } from '@/components/ui/NumberInput';
import { PanelSection } from '@/components/ui/PanelSection';
import { NodeInspector } from './NodeInspector';
import { SegmentInspector } from './SegmentInspector';

export function Inspector({ onDelete }: { onDelete: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const selection = useEditor((s) => s.ui.selection);
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  if (selection.length === 1) {
    const id = selection[0]!;
    const node = doc.nodes.find((n) => n.id === id);
    if (node) return <NodeInspector node={node} onDelete={() => onDelete([id])} />;
    const segment = doc.segments.find((s) => s.id === id);
    if (segment) return <SegmentInspector segment={segment} onDelete={() => onDelete([id])} />;
    const wall = doc.floors.flatMap((f) => f.walls).find((w) => w.id === id);
    if (wall) return <WallInspector wall={wall} />;
  }
  if (selection.length > 1) {
    return (
      <PanelSection title={t('inspector.multiple', { count: selection.length })}>
        <div className="flex flex-col gap-2">
          <p className="text-text-muted">{t('inspector.multipleHint')}</p>
          <Button variant="danger-ghost" disabled={readOnly} onClick={() => onDelete(selection)}>
            <Trash2 size={16} />
            {t('inspector.delete')}
          </Button>
        </div>
      </PanelSection>
    );
  }
  return <EmptyState message={t('editor.empty.selection')} />;
}

function WallInspector({ wall }: { wall: Wall }) {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const update = (label: string, fn: (w: Wall) => void) =>
    store.getState().applyCommand(label, (d) => {
      for (const f of d.doc.floors) {
        const w = f.walls.find((x) => x.id === wall.id);
        if (w) fn(w);
      }
    });
  const length = distance(wall.a, wall.b);
  const coord = (end: 'a' | 'b', axis: 'x' | 'y') => (
    <NumberInput
      aria-label={t(`inspector.wall.${end}${axis}`)}
      value={wall[end][axis]}
      unit="m"
      disabled={readOnly}
      onValueChange={(v) => update('move wall end', (w) => void (w[end][axis] = v))}
    />
  );
  return (
    <div data-testid="wall-inspector">
      <PanelSection title={t('inspector.wall.title')}>
        <div className="flex flex-col gap-2">
          <p className="font-mono tabular-nums" data-testid="wall-length">
            {t('inspector.wall.lengthValue', { length: formatLength(length, locale) })}
          </p>
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t('inspector.wall.length')}
            <NumberInput
              aria-label={t('inspector.wall.length')}
              value={Math.round(length * 1000) / 1000}
              unit="m"
              min={0.01}
              disabled={readOnly}
              onValueChange={(v) =>
                update('wall length', (w) => {
                  const ratio = v / distance(w.a, w.b);
                  w.b = {
                    x: w.a.x + (w.b.x - w.a.x) * ratio,
                    y: w.a.y + (w.b.y - w.a.y) * ratio,
                  };
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t('inspector.wall.thickness')}
            <NumberInput
              aria-label={t('inspector.wall.thickness')}
              value={wall.thickness}
              unit="m"
              min={0.01}
              max={2}
              disabled={readOnly}
              onValueChange={(v) => update('wall thickness', (w) => void (w.thickness = v))}
            />
          </label>
          <div className="grid grid-cols-2 gap-1">
            {coord('a', 'x')}
            {coord('a', 'y')}
            {coord('b', 'x')}
            {coord('b', 'y')}
          </div>
        </div>
      </PanelSection>
      <div className="p-3">
        <Button
          variant="danger-ghost"
          disabled={readOnly}
          onClick={() =>
            store.getState().applyCommand('delete wall', (d) => {
              for (const f of d.doc.floors) f.walls = f.walls.filter((w) => w.id !== wall.id);
            })
          }
        >
          <Trash2 size={16} />
          {t('inspector.delete')}
        </Button>
      </div>
    </div>
  );
}
