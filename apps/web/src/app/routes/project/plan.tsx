import { toggleRouteSegment, toggleTarget } from '@/features/circuits/utils/commands';
import type { CanvasPickHandlers } from '@/features/editor/canvas/hooks/usePlanPointer';
import { PlanView } from '@/features/editor/components/PlanView';

const circuitPicking: CanvasPickHandlers = { toggleTarget, toggleRouteSegment };

/** Plan editor; picking circuit targets/routes on the canvas edits the circuits. */
export function PlanRoute() {
  return <PlanView pickHandlers={circuitPicking} />;
}
