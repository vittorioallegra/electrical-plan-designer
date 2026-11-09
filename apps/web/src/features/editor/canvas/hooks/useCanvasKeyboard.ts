import { useEffect } from 'react';
import type { EditorStore } from '@/stores/editor/editorStore';
import type { PlanPointer } from './usePlanPointer';

/**
 * Canvas shortcuts (ignored while typing in a field): Escape closes an exploded column, leaves
 * picking, cancels the action or returns to Select; Enter opens the column of the selected box; Backspace/Enter edit the conduit being drawn; Tab cycles
 * overlapping hits; Delete/Backspace asks to delete the selection.
 */
export function useCanvasKeyboard({
  store,
  tool,
  pointer,
  onDeleteRequest,
}: {
  store: EditorStore;
  tool: string;
  pointer: PlanPointer;
  onDeleteRequest: (ids: string[]) => void;
}) {
  // Re-subscribed on every render, so the handler always sees the current pointer state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      if (e.key === 'Escape') {
        if (pointer.exploded) {
          pointer.closeExploded();
          return;
        }
        if (store.getState().ui.pick) {
          store.getState().setUi({ pick: null });
          return;
        }
        if (pointer.hasAction) {
          pointer.cancelAction();
        } else {
          store.getState().setUi({ tool: 'select', selection: [] });
        }
        return;
      }
      if (tool === 'conduit' && pointer.conduit) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          pointer.popConduitVertex();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          pointer.finishConduitAtVertex();
          return;
        }
      }
      const selection = store.getState().ui.selection;
      if (e.key === 'Enter' && tool === 'select' && selection.length === 1 && !pointer.exploded) {
        pointer.explode(selection[0]!);
        return;
      }
      const lastHits = pointer.lastHits.current;
      if (e.key === 'Tab' && lastHits && lastHits.hits.length > 1) {
        e.preventDefault();
        const next = (lastHits.index + 1) % lastHits.hits.length;
        lastHits.index = next;
        pointer.select([lastHits.hits[next]!.id]);
        return;
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        store.getState().ui.selection.length > 0
      ) {
        e.preventDefault();
        onDeleteRequest(store.getState().ui.selection);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}
