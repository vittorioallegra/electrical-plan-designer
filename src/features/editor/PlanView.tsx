import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cascadeOf } from '@/domain/edits';
import type { Point } from '@/domain/types';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { useToast } from '@/ui/Toast';
import { BackgroundImportDialog } from './background/BackgroundImportDialog';
import { CalibrationDialog } from './background/CalibrationDialog';
import { PlanCanvas } from './canvas/PlanCanvas';
import { copySelection, deleteIds, pasteClipboard } from './commands';
import { FloorsPanel } from './FloorsPanel';
import { Inspector } from './Inspector';
import { ToolPalette, toolHintKey, toolShortcuts } from './ToolPalette';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Plan view: floor tabs + tools on the left, canvas, inspector on the right. */
export function PlanView() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const [calibration, setCalibration] = useState<[Point, Point] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
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
  const pick = useEditor((s) => s.ui.pick);
  const pickName = useEditor((s) =>
    s.ui.pick
      ? s.ui.pick.owner.kind === 'circuit'
        ? (s.data.doc.circuits.find((c) => c.id === s.ui.pick!.owner.id)?.name ?? '')
        : ''
      : '',
  );

  /** Deletes at once, or asks first when the cascade reaches beyond the selection. */
  function requestDelete(ids: string[]) {
    if (readOnly || ids.length === 0) return;
    const summary = cascadeOf(store.getState().data.doc, ids, ids);
    const extraSegments = summary.segmentIds.filter((id) => !ids.includes(id));
    if (
      extraSegments.length === 0 &&
      summary.circuitIds.length === 0 &&
      summary.extraRunIds.length === 0
    ) {
      deleteIds(store, ids);
    } else {
      setPendingDelete(ids);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'c') {
        if (copySelection(store) > 0) e.preventDefault();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v' && !readOnly) {
        if (pasteClipboard(store).length > 0) e.preventDefault();
        return;
      }
      if (mod || e.altKey) return;
      const next = toolShortcuts[e.key.toLowerCase()];
      if (next && (!readOnly || next === 'select'))
        store.getState().setUi({ tool: next, selection: [] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, readOnly]);

  const summary = pendingDelete ? cascadeOf(doc, pendingDelete, pendingDelete) : null;
  const circuitNames = summary
    ? doc.circuits.filter((c) => summary.circuitIds.includes(c.id)).map((c) => c.name)
    : [];
  const hint = toolHintKey(tool);

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
        <PlanCanvas
          onCalibrationPoints={(p1, p2) => setCalibration([p1, p2])}
          onDeleteRequest={requestDelete}
        />
        {pick ? (
          <div
            className="absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded bg-accent px-3 py-1 text-accent-contrast"
            role="status"
            data-testid="pick-banner"
          >
            <span>{t(`circuits.pickBanner.${pick.mode}`, { name: pickName })}</span>
            <Button onClick={() => store.getState().setUi({ pick: null })}>
              {t('circuits.done')}
            </Button>
          </div>
        ) : hint ? (
          <p
            className="pointer-events-none absolute top-2 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-text px-3 py-1 text-center text-surface"
            role="status"
          >
            {t(hint)}
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
        <Inspector onImport={() => setImporting(true)} onDelete={requestDelete} />
      </aside>
      <BackgroundImportDialog open={importing} onClose={() => setImporting(false)} />
      <CalibrationDialog points={calibration} onClose={() => setCalibration(null)} />
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('editor.deleteConfirm.title')}
        description={t('editor.deleteConfirm.body', {
          nodes: summary?.nodeIds.length ?? 0,
          segments: summary?.segmentIds.length ?? 0,
        })}
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteIds(store, pendingDelete!);
                setPendingDelete(null);
                toast(t('editor.deleteConfirm.done'));
              }}
            >
              {t('inspector.delete')}
            </Button>
          </>
        }
      >
        {circuitNames.length > 0 ? (
          <div data-testid="delete-affected">
            <p>{t('editor.deleteConfirm.circuits')}</p>
            <ul className="list-disc pl-5">
              {circuitNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
