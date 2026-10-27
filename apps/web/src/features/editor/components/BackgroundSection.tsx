import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { PanelSection } from '@/components/ui/PanelSection';
import { formatLength } from '@/lib/format';
import { useCanvasEmpty } from '@/features/editor/hooks/useCanvasEmpty';

/**
 * Background plan of the active floor. While the canvas is empty its own empty state is the one
 * "Import plan"; this section offers it only once there is something on the canvas.
 */
export function BackgroundSection({ onImport }: { onImport: () => void }) {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const floorId = useEditor((s) => s.ui.floorId);
  const bg = useEditor((s) => s.data.doc.floors.find((f) => f.id === s.ui.floorId)?.background);
  const canvasEmpty = useCanvasEmpty();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const update = (label: string, fn: (b: NonNullable<typeof bg>) => void) =>
    store.getState().applyCommand(label, (d) => {
      const b = d.doc.floors.find((f) => f.id === floorId)?.background;
      if (b) fn(b);
    });

  if (!bg) {
    if (canvasEmpty) return null;
    return (
      <PanelSection title={t('background.title')}>
        <Button disabled={readOnly} onClick={onImport}>
          {t('background.import')}
        </Button>
      </PanelSection>
    );
  }
  return (
    <PanelSection
      title={t('background.title')}
      actions={
        <>
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={onImport}>
            {t('background.replace')}
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
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
        </>
      }
    >
      <div className="flex flex-col gap-2" data-testid="background-panel">
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
        <label className="flex flex-col gap-1 text-small text-text-muted">
          {t('background.opacity')}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(bg.opacity * 100)}
            disabled={readOnly}
            className="accent-accent"
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
        <label className="flex flex-col gap-1 text-small text-text-muted">
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
      </div>
    </PanelSection>
  );
}
