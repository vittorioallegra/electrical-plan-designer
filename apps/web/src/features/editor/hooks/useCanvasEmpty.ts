import { useEditor } from '@/stores/editor/EditorContext';

/** True when the active floor has no background, no walls and no nodes: nothing to look at yet. */
export function useCanvasEmpty(): boolean {
  return useEditor((s) => {
    const floor = s.data.doc.floors.find((f) => f.id === s.ui.floorId);
    return (
      !!floor &&
      !floor.background &&
      floor.walls.length === 0 &&
      !s.data.doc.nodes.some((n) => n.floorId === floor.id)
    );
  });
}
