import type Konva from 'konva';
import { useRef, type RefObject } from 'react';
import type { Point } from '@epd/domain/types';
import type { EditorStore } from '@/stores/editor/editorStore';
import { zoomAt, type View } from '../viewport';

/** Touch: one finger pans, two fingers pinch-zoom around their midpoint. */
export function useTouchNavigation(
  store: EditorStore,
  container: RefObject<HTMLDivElement | null>,
) {
  const touch = useRef<{ view: View; points: Point[] } | null>(null);
  function touchPoints(e: Konva.KonvaEventObject<TouchEvent>): Point[] {
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return [];
    return [...e.evt.touches].map((t) => ({ x: t.clientX - rect.left, y: t.clientY - rect.top }));
  }
  function onTouchStart(e: Konva.KonvaEventObject<TouchEvent>) {
    e.evt.preventDefault();
    touch.current = { view: store.getState().ui.view, points: touchPoints(e) };
  }
  function onTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    e.evt.preventDefault();
    const start = touch.current;
    const points = touchPoints(e);
    if (!start || points.length === 0) return;
    if (points.length >= 2 && start.points.length >= 2) {
      const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const c0 = mid(start.points[0]!, start.points[1]!);
      const c1 = mid(points[0]!, points[1]!);
      const d0 = Math.hypot(
        start.points[1]!.x - start.points[0]!.x,
        start.points[1]!.y - start.points[0]!.y,
      );
      const d1 = Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y);
      const zoomed = zoomAt(start.view, c0, d0 > 0 ? d1 / d0 : 1);
      store.getState().setUi({
        view: { ...zoomed, x: zoomed.x + c1.x - c0.x, y: zoomed.y + c1.y - c0.y },
      });
    } else {
      store.getState().setUi({
        view: {
          ...start.view,
          x: start.view.x + points[0]!.x - start.points[0]!.x,
          y: start.view.y + points[0]!.y - start.points[0]!.y,
        },
      });
    }
  }
  function onTouchEnd(e: Konva.KonvaEventObject<TouchEvent>) {
    const points = touchPoints(e);
    touch.current = points.length > 0 ? { view: store.getState().ui.view, points } : null;
  }
  return { onTouchStart, onTouchMove, onTouchEnd };
}
