import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { distance } from '@epd/domain/geometry';
import type { Wall } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { formatLength } from '@/lib/format';
import { NumberInput } from '@/components/ui/NumberInput';
import { NodeInspector } from './NodeInspector';
import { SegmentInspector } from './SegmentInspector';

export function Inspector({
  onImport,
  onDelete,
}: {
  onImport: () => void;
  onDelete: (ids: string[]) => void;
}) {
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
      <div className="flex flex-col gap-2">
        <p className="text-text-muted">{t('inspector.multiple', { count: selection.length })}</p>
        <p className="text-text-muted">{t('inspector.multipleHint')}</p>
        <Button variant="danger-ghost" disabled={readOnly} onClick={() => onDelete(selection)}>
          <Trash2 size={16} />
          {t('inspector.delete')}
        </Button>
      </div>
    );
  }
  return <BackgroundPanel onImport={onImport} />;
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
    <div className="flex flex-col gap-2" data-testid="wall-inspector">
      <h2 className="font-medium">{t('inspector.wall.title')}</h2>
      <p data-testid="wall-length">
        {t('inspector.wall.lengthValue', { length: formatLength(length, locale) })}
      </p>
      <label className="flex flex-col gap-1">
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
              w.b = { x: w.a.x + (w.b.x - w.a.x) * ratio, y: w.a.y + (w.b.y - w.a.y) * ratio };
            })
          }
        />
      </label>
      <label className="flex flex-col gap-1">
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
  );
}

function BackgroundPanel({ onImport }: { onImport: () => void }) {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const floorId = useEditor((s) => s.ui.floorId);
  const bg = useEditor((s) => s.data.doc.floors.find((f) => f.id === s.ui.floorId)?.background);
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const update = (label: string, fn: (b: NonNullable<typeof bg>) => void) =>
    store.getState().applyCommand(label, (d) => {
      const b = d.doc.floors.find((f) => f.id === floorId)?.background;
      if (b) fn(b);
    });
  if (!bg) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-text-muted">{t('editor.empty.selection')}</p>
        <Button disabled={readOnly} onClick={onImport}>
          {t('background.import')}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="background-panel">
      <h2 className="font-medium">{t('background.title')}</h2>
      <p className={bg.calibration ? 'text-text-muted' : 'text-warning'}>
        {bg.calibration
          ? t('background.calibrated', {
              length: formatLength(bg.calibration.realDistance, locale),
            })
          : t('background.notCalibrated')}
      </p>
      <Button
        disabled={readOnly}
        onClick={() => store.getState().setUi({ tool: 'calibrate', selection: [] })}
      >
        {t(bg.calibration ? 'background.recalibrate' : 'background.calibrate')}
      </Button>
      <label className="flex flex-col gap-1">
        {t('background.opacity')}
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(bg.opacity * 100)}
          disabled={readOnly}
          onChange={(e) =>
            update('background opacity', (b) => void (b.opacity = Number(e.target.value) / 100))
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-1">
        <NumberInput
          aria-label={t('background.offsetX')}
          value={bg.offset.x}
          unit="m"
          disabled={readOnly}
          onValueChange={(v) => update('background offset', (b) => void (b.offset.x = v))}
        />
        <NumberInput
          aria-label={t('background.offsetY')}
          value={bg.offset.y}
          unit="m"
          disabled={readOnly}
          onValueChange={(v) => update('background offset', (b) => void (b.offset.y = v))}
        />
      </div>
      <label className="flex flex-col gap-1">
        {t('background.rotation')}
        <NumberInput
          aria-label={t('background.rotation')}
          value={bg.rotation}
          unit="°"
          min={-360}
          max={360}
          disabled={readOnly}
          onValueChange={(v) => update('background rotation', (b) => void (b.rotation = v))}
        />
      </label>
      <div className="flex gap-1">
        <Button disabled={readOnly} onClick={onImport}>
          {t('background.replace')}
        </Button>
        <Button
          variant="ghost"
          disabled={readOnly}
          onClick={() =>
            store.getState().applyCommand('remove background', (d) => {
              const f = d.doc.floors.find((x) => x.id === floorId);
              if (f) delete f.background;
            })
          }
        >
          {t('background.remove')}
        </Button>
      </div>
    </div>
  );
}
