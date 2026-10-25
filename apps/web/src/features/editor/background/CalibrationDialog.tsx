import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Point } from '@epd/domain/types';
import { useEditorContext } from '@/state/EditorContext';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { NumberInput } from '@/ui/NumberInput';

/** Asks the real distance between the two clicked background points, then calibrates. */
export function CalibrationDialog({
  points,
  onClose,
}: {
  points: [Point, Point] | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const [distance, setDistance] = useState<number | null>(null);

  function confirm() {
    if (!points || !distance) return;
    const floorId = store.getState().ui.floorId;
    store.getState().applyCommand('calibrate background', (d) => {
      const bg = d.doc.floors.find((f) => f.id === floorId)?.background;
      if (bg) bg.calibration = { p1: points[0], p2: points[1], realDistance: distance };
    });
    store.getState().setUi({ tool: 'select' });
    setDistance(null);
    onClose();
  }

  return (
    <Dialog
      open={points !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('background.calibrateTitle')}
      description={t('background.calibrateHint')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!distance} onClick={confirm}>
            {t('background.calibrate')}
          </Button>
        </>
      }
    >
      <label className="flex items-center gap-3">
        {t('background.realDistance')}
        <NumberInput
          aria-label={t('background.realDistance')}
          autoFocus
          value={distance}
          unit="m"
          min={0.01}
          max={1000}
          live
          onValueChange={setDistance}
          onKeyUp={(e) => {
            if (e.key === 'Enter' && distance) confirm();
          }}
        />
      </label>
    </Dialog>
  );
}
