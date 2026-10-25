// Click-to-select: brings the element a warning points at into view.
import type { ElementRef } from '@epd/domain/checks';
import type { EditorStore } from '@/stores/editor/editorStore';

export type FocusTarget = 'plan' | 'panel';

/** Selects the element and returns the view that shows it. */
export function focusElement(store: EditorStore, ref: ElementRef): FocusTarget {
  const { data, setUi } = store.getState();
  const doc = data.doc;
  switch (ref.kind) {
    case 'panel_device':
      setUi({ selection: [ref.id], pick: null });
      return 'panel';
    case 'circuit':
    case 'extra_run':
      setUi({
        activeOwner: { kind: ref.kind === 'circuit' ? 'circuit' : 'extra', id: ref.id },
        drawerTab: 'circuits',
        selection: [],
        pick: null,
      });
      return 'plan';
    case 'node': {
      const node = doc.nodes.find((n) => n.id === ref.id);
      setUi({
        selection: [ref.id],
        pick: null,
        ...(node ? { floorId: node.floorId, focus: node.position } : {}),
      });
      return 'plan';
    }
    case 'segment': {
      const segment = doc.segments.find((s) => s.id === ref.id);
      const from = doc.nodes.find((n) => n.id === segment?.fromNodeId);
      const to = doc.nodes.find((n) => n.id === segment?.toNodeId);
      // A riser's ends sit on two floors: show the floor of its first end.
      const sameFloor = from && to && from.floorId === to.floorId;
      const focus =
        from && to && sameFloor
          ? { x: (from.position.x + to.position.x) / 2, y: (from.position.y + to.position.y) / 2 }
          : from?.position;
      setUi({
        selection: [ref.id],
        pick: null,
        ...(from && focus ? { floorId: from.floorId, focus } : {}),
      });
      return 'plan';
    }
  }
}
