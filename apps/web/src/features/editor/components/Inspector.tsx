import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { distance } from '@epd/domain/geometry';
import type { ProjectDoc, Wall } from '@epd/domain/types';
import {
  findWall,
  MIN_WALL_LENGTH,
  moveWallEnd,
  setWallLength,
  type WallEnd,
} from '@epd/domain/walls';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
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
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const edit = (label: string, recipe: (doc: ProjectDoc) => void) =>
    store.getState().applyCommand(label, (d) => recipe(d.doc));
  const coord = (end: WallEnd, axis: 'x' | 'y') => (
    <label className="flex items-center gap-2 text-small text-text-muted">
      <span className="w-3 shrink-0">{axis.toUpperCase()}</span>
      <NumberInput
        aria-label={t(`inspector.wall.${end}${axis}`)}
        value={wall[end][axis]}
        unit="m"
        disabled={readOnly}
        onValueChange={(v) =>
          edit('move wall end', (doc) =>
            moveWallEnd(doc, wall.id, end, { ...wall[end], [axis]: v }),
          )
        }
      />
    </label>
  );
  const point = (end: WallEnd) => (
    <div className="flex flex-col gap-1">
      <span className="text-small font-medium text-text">{t(`inspector.wall.${end}`)}</span>
      <div className="grid grid-cols-2 gap-2">
        {coord(end, 'x')}
        {coord(end, 'y')}
      </div>
    </div>
  );
  return (
    <div data-testid="wall-inspector">
      <PanelSection title={t('inspector.wall.title')}>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t('inspector.wall.length')}
            <NumberInput
              aria-label={t('inspector.wall.length')}
              value={Math.round(distance(wall.a, wall.b) * 1000) / 1000}
              unit="m"
              min={MIN_WALL_LENGTH}
              disabled={readOnly}
              onValueChange={(v) => edit('wall length', (doc) => setWallLength(doc, wall.id, v))}
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
              onValueChange={(v) =>
                edit('wall thickness', (doc) => {
                  const w = findWall(doc, wall.id);
                  if (w) w.thickness = v;
                })
              }
            />
          </label>
          <p className="text-small text-text-muted">{t('inspector.wall.dragHint')}</p>
        </div>
      </PanelSection>
      <PanelSection title={t('inspector.wall.coordinates')} collapsible>
        <div className="flex flex-col gap-3">
          <p className="text-small text-text-muted">{t('inspector.wall.coordinatesHint')}</p>
          {point('a')}
          {point('b')}
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
