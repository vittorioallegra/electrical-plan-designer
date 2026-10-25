// Circuit and extra-run commands.
import { newId } from '@/domain/ids';
import type { RoutingResult } from '@/domain/routing';
import type { Circuit, ExtraConductorRun, ProjectDoc, Routing } from '@/domain/types';
import type { EditorStore } from '@/state/editorStore';

export const SECTIONS = [1.5, 2.5, 4, 6, 10] as const;

export const defaultSectionByType: Record<Circuit['type'], number> = {
  lighting: 1.5,
  sockets: 2.5,
  dedicated: 4,
  other: 2.5,
};

export function nextCircuitName(doc: ProjectDoc, base: string): string {
  const used = new Set(doc.circuits.map((c) => c.name));
  for (let i = doc.circuits.length + 1; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
}

export function createCircuit(
  store: EditorStore,
  panelDeviceId: string,
  name: string,
): string | null {
  const id = newId();
  const circuit: Circuit = {
    id,
    name,
    type: 'sockets',
    panelDeviceId,
    crossSection: 2.5,
    conductors: [
      { role: 'L', color: 'brown' },
      { role: 'N', color: 'blue' },
      { role: 'PE', color: 'yellow_green' },
    ],
    targetNodeIds: [],
    routing: { mode: 'auto' },
  };
  const result = store
    .getState()
    .applyCommand('add circuit', (d) => void d.doc.circuits.push(circuit));
  if (!result.ok) return null;
  store.getState().setUi({ activeOwner: { kind: 'circuit', id } });
  return id;
}

export function updateCircuit(
  store: EditorStore,
  id: string,
  label: string,
  fn: (c: Circuit) => void,
) {
  return store.getState().applyCommand(label, (d) => {
    const c = d.doc.circuits.find((x) => x.id === id);
    if (c) fn(c);
  });
}

export function deleteCircuit(store: EditorStore, id: string) {
  store.getState().applyCommand('delete circuit', (d) => {
    d.doc.circuits = d.doc.circuits.filter((c) => c.id !== id);
    for (const r of d.doc.extraRuns) if (r.circuitId === id) delete r.circuitId;
  });
  const ui = store.getState().ui;
  if (ui.activeOwner?.id === id) store.getState().setUi({ activeOwner: null, pick: null });
}

export function updateExtraRun(
  store: EditorStore,
  id: string,
  label: string,
  fn: (r: ExtraConductorRun) => void,
) {
  return store.getState().applyCommand(label, (d) => {
    const r = d.doc.extraRuns.find((x) => x.id === id);
    if (r) fn(r);
  });
}

export function deleteExtraRun(store: EditorStore, id: string) {
  store.getState().applyCommand('delete extra run', (d) => {
    d.doc.extraRuns = d.doc.extraRuns.filter((r) => r.id !== id);
  });
  if (store.getState().ui.activeOwner?.id === id)
    store.getState().setUi({ activeOwner: null, pick: null });
}

/** Two travelers between two two-way switch boxes (1.5 mm² black + grey). */
export function addTwoWayRun(
  store: EditorStore,
  fromNodeId: string,
  toNodeId: string,
  circuitId?: string,
): string | null {
  return addExtraRun(store, {
    fromNodeId,
    toNodeId,
    ...(circuitId ? { circuitId } : {}),
    conductors: [
      { role: 'traveler', crossSection: 1.5, color: 'black' },
      { role: 'traveler', crossSection: 1.5, color: 'grey' },
    ],
  });
}

export function addExtraRun(
  store: EditorStore,
  run: Omit<ExtraConductorRun, 'id' | 'routing'>,
): string | null {
  const id = newId();
  const result = store
    .getState()
    .applyCommand(
      'add extra run',
      (d) => void d.doc.extraRuns.push({ ...run, id, routing: { mode: 'auto' } }),
    );
  if (!result.ok) return null;
  store.getState().setUi({ activeOwner: { kind: 'extra', id } });
  return id;
}

type Owner = { kind: 'circuit' | 'extra'; id: string };

function editRouting(
  store: EditorStore,
  owner: Owner,
  label: string,
  fn: (r: { routing: Routing }) => void,
) {
  return owner.kind === 'circuit'
    ? updateCircuit(store, owner.id, label, fn)
    : updateExtraRun(store, owner.id, label, fn);
}

/** Switching to manual starts from the current auto route, so the user only adjusts it. */
export function setRoutingMode(
  store: EditorStore,
  owner: Owner,
  mode: Routing['mode'],
  routing: RoutingResult,
) {
  const current =
    owner.kind === 'circuit'
      ? routing.circuitRoutes.get(owner.id)
      : routing.extraRunRoutes.get(owner.id);
  const segmentIds = current?.ok ? current.segmentIds : [];
  return editRouting(store, owner, 'routing mode', (r) => {
    r.routing = mode === 'auto' ? { mode: 'auto' } : { mode: 'manual', segmentIds };
  });
}

export function toggleRouteSegment(store: EditorStore, owner: Owner, segmentId: string) {
  return editRouting(store, owner, 'edit manual route', (r) => {
    if (r.routing.mode !== 'manual') return;
    const ids = r.routing.segmentIds;
    r.routing.segmentIds = ids.includes(segmentId)
      ? ids.filter((x) => x !== segmentId)
      : [...ids, segmentId];
  });
}

export function toggleTarget(store: EditorStore, circuitId: string, nodeId: string) {
  return updateCircuit(store, circuitId, 'edit circuit targets', (c) => {
    c.targetNodeIds = c.targetNodeIds.includes(nodeId)
      ? c.targetNodeIds.filter((x) => x !== nodeId)
      : [...c.targetNodeIds, nodeId];
  });
}
