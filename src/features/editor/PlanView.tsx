import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Point } from '@/domain/types';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import { Button } from '@/ui/Button';
import { BackgroundImportDialog } from './background/BackgroundImportDialog';
import { CalibrationDialog } from './background/CalibrationDialog';
import { PlanCanvas } from './canvas/PlanCanvas';
import { FloorsPanel } from './FloorsPanel';
import { Inspector } from './Inspector';
import { ToolPalette, toolShortcuts } from './ToolPalette';

/** Plan view: floor tabs + tools on the left, canvas, inspector on the right. */
export function PlanView() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const [importing, setImporting] = useState(false);
  const [calibration, setCalibration] = useState<[Point, Point] | null>(null);
  const readOnly = useEditor((s) => s.readOnly);
  const empty = useEditor((s) => {
    const floor = s.data.doc.floors.find((f) => f.id === s.ui.floorId);
    return (
      !!floor &&
      !floor.background &&
      floor.walls.length === 0 &&
      !s.data.doc.nodes.some((n) => n.floorId === floor.id)
    );
  });
  const tool = useEditor((s) => s.ui.tool);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      const next = toolShortcuts[e.key.toLowerCase()];
      if (next && (!readOnly || next === 'select'))
        store.getState().setUi({ tool: next, selection: [] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, readOnly]);

  return (
    <div className="flex h-full">
      <aside
        className="flex w-52 flex-col gap-4 overflow-y-auto border-r border-border p-2"
        aria-label={t('editor.tools')}
      >
        <h1 className="sr-only">{t('pages.plan')}</h1>
        <FloorsPanel />
        <ToolPalette />
      </aside>
      <div className="relative min-w-0 flex-1 bg-canvas-bg" data-testid="canvas-area">
        <PlanCanvas onCalibrationPoints={(p1, p2) => setCalibration([p1, p2])} />
        {tool === 'calibrate' ? (
          <p
            className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-text px-3 py-1 text-surface"
            role="status"
          >
            {t('background.calibrateClick')}
          </p>
        ) : null}
        {empty && tool === 'select' && !readOnly ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            data-testid="empty-canvas"
          >
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 shadow">
              <p className="text-text-muted">{t('editor.emptyCanvas')}</p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => setImporting(true)}>
                  {t('background.import')}
                </Button>
                <Button onClick={() => store.getState().setUi({ tool: 'wall' })}>
                  {t('tools.drawWalls')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <aside
        className="w-64 overflow-y-auto border-l border-border p-2"
        aria-label={t('editor.inspector')}
      >
        <Inspector onImport={() => setImporting(true)} />
      </aside>
      <BackgroundImportDialog open={importing} onClose={() => setImporting(false)} />
      <CalibrationDialog points={calibration} onClose={() => setCalibration(null)} />
    </div>
  );
}
