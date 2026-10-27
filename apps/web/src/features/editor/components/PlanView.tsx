import { PanelLeft, PanelRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';
import type { Point } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';
import { BackgroundImportDialog } from '@/features/editor/background/BackgroundImportDialog';
import { CalibrationDialog } from '@/features/editor/background/CalibrationDialog';
import type { CanvasPickHandlers } from '@/features/editor/canvas/hooks/usePlanPointer';
import { PlanCanvas } from '@/features/editor/canvas/PlanCanvas';
import {
  cascadeOfSelection,
  copySelection,
  deleteIds,
  pasteClipboard,
} from '@/features/editor/utils/commands';
import { useCanvasEmpty } from '@/features/editor/hooks/useCanvasEmpty';
import { cn } from '@/lib/cn';
import { BackgroundSection } from './BackgroundSection';
import { FloorsPanel } from './FloorsPanel';
import { Inspector } from './Inspector';
import { RunLegend } from './RunLegend';
import { PresetPicker, ToolRail, toolHintKey, toolShortcuts } from './ToolRail';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

type SideKey = 'leftPanelOpen' | 'inspectorOpen';

/** Keeps a collapsible side panel in step with its open flag in the editor store. */
function useSidePanel(key: SideKey) {
  const { store } = useEditorContext();
  const open = useEditor((s) => s.ui[key]);
  const ref = usePanelRef();
  // Read once: later size changes come from the panel itself.
  const [initial] = useState(open);
  useEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    if (open) {
      if (handle.isCollapsed()) handle.expand();
    } else if (!handle.isCollapsed()) handle.collapse();
  }, [open, ref]);
  // Dragging below the minimum collapses the panel; the store follows.
  const onResize = (size: { inPixels: number }) => {
    if (size.inPixels === 0 && ref.current?.isCollapsed() && store.getState().ui[key])
      store.getState().setUi({ [key]: false });
  };
  return { open, ref, initial, onResize };
}

const separatorClass =
  'relative bg-border transition-colors after:absolute after:inset-y-0 after:-right-1 after:-left-1 after:content-[""] data-[separator=active]:bg-accent data-[separator=hover]:bg-accent';

/** Plan view: floor tabs + tools on the left, canvas, inspector on the right. */
export function PlanView({ pickHandlers }: { pickHandlers?: CanvasPickHandlers }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const [calibration, setCalibration] = useState<[Point, Point] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const readOnly = useEditor((s) => s.readOnly);
  const doc = useEditor((s) => s.data.doc);
  const empty = useCanvasEmpty();
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
    const summary = cascadeOfSelection(store.getState().data.doc, ids);
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

  const summary = pendingDelete ? cascadeOfSelection(doc, pendingDelete) : null;
  const circuitNames = summary
    ? doc.circuits.filter((c) => summary.circuitIds.includes(c.id)).map((c) => c.name)
    : [];
  const hint = toolHintKey(tool);
  const left = useSidePanel('leftPanelOpen');
  const right = useSidePanel('inspectorOpen');

  return (
    <div className="flex h-full">
      <ToolRail />
      <Group orientation="horizontal" className="min-w-0 flex-1">
        <Panel
          id="plan-left"
          panelRef={left.ref}
          collapsible
          collapsedSize="0px"
          minSize="200px"
          maxSize="400px"
          defaultSize={left.initial ? '248px' : '0px'}
          onResize={left.onResize}
        >
          <aside
            aria-label={t('editor.leftPanel')}
            aria-hidden={!left.open}
            inert={!left.open}
            className="h-full w-full min-w-0 overflow-y-auto bg-panel"
          >
            <h1 className="sr-only">{t('pages.plan')}</h1>
            <FloorsPanel />
            <BackgroundSection onImport={() => setImporting(true)} />
          </aside>
        </Panel>
        <Separator
          disabled={!left.open}
          className={cn(separatorClass, left.open ? 'w-px' : 'w-0 after:hidden')}
        />
        <Panel id="plan-center" minSize="320px">
          <div className="relative h-full w-full min-w-0 bg-canvas-bg" data-testid="canvas-area">
            <PlanCanvas
              onCalibrationPoints={(p1, p2) => setCalibration([p1, p2])}
              onDeleteRequest={requestDelete}
              pickHandlers={pickHandlers}
            />
            {pick ? (
              <div
                className="absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded bg-accent px-3 py-1 text-small text-on-accent shadow-pop"
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
                className="pointer-events-none absolute top-2 left-1/2 max-w-[90%] -translate-x-1/2 rounded-md bg-text px-3 py-1 text-center text-small text-panel"
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
                <EmptyState
                  className="rounded-lg border border-border bg-raised shadow-pop"
                  message={t('editor.emptyCanvas')}
                  action={
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => setImporting(true)}>
                        {t('background.import')}
                      </Button>
                      <Button onClick={() => store.getState().setUi({ tool: 'wall' })}>
                        {t('tools.drawWalls')}
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : null}
            <div className="absolute top-2 left-2 flex flex-col items-start gap-2">
              <div className="rounded-md border border-border bg-raised p-0.5 shadow-pop">
                <IconButton
                  label={t('editor.leftPanel')}
                  icon={<PanelLeft size={16} />}
                  pressed={left.open}
                  onClick={() => store.getState().setUi({ leftPanelOpen: !left.open })}
                />
              </div>
              <PresetPicker />
            </div>
            <div className="absolute top-2 right-2 rounded-md border border-border bg-raised p-0.5 shadow-pop">
              <IconButton
                label={t('editor.inspector')}
                icon={<PanelRight size={16} />}
                pressed={right.open}
                onClick={() => store.getState().setUi({ inspectorOpen: !right.open })}
              />
            </div>
            <RunLegend />
          </div>
        </Panel>
        <Separator
          disabled={!right.open}
          className={cn(separatorClass, right.open ? 'w-px' : 'w-0 after:hidden')}
        />
        <Panel
          id="plan-inspector"
          panelRef={right.ref}
          collapsible
          collapsedSize="0px"
          minSize="200px"
          maxSize="400px"
          defaultSize={right.initial ? '280px' : '0px'}
          onResize={right.onResize}
        >
          <aside
            aria-label={t('editor.inspector')}
            aria-hidden={!right.open}
            inert={!right.open}
            className="h-full w-full min-w-0 overflow-y-auto bg-panel"
          >
            <Inspector onDelete={requestDelete} />
          </aside>
        </Panel>
      </Group>
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
              variant="danger-ghost"
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
