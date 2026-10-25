// Small builders for domain test fixtures. Test-only.
import { DEFAULT_CONDUIT_ID } from '../catalog/builtin';
import { CURRENT_SCHEMA_VERSION } from '../schema';
import type {
  Circuit,
  ConduitSegment,
  ExtraConductorRun,
  Floor,
  Panel,
  PlanNode,
  ProjectDoc,
} from '../types';

export function floor(id: string, order: number, height = 2.7): Floor {
  return { id, name: id, order, height, walls: [] };
}

export function node(
  id: string,
  floorId: string,
  kind: PlanNode['kind'],
  x: number,
  y: number,
  extra: Partial<PlanNode> = {},
): PlanNode {
  return { id, floorId, kind, position: { x, y }, label: id, status: 'active', ...extra };
}

export function seg(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  extra: Partial<ConduitSegment> = {},
): ConduitSegment {
  return {
    id,
    fromNodeId,
    toNodeId,
    vertices: [],
    conduitItemId: DEFAULT_CONDUIT_ID,
    runElevation: 'floor',
    ...extra,
  };
}

export const standardConductors: Circuit['conductors'] = [
  { role: 'L', color: 'brown' },
  { role: 'N', color: 'blue' },
  { role: 'PE', color: 'yellow_green' },
];

export function circuit(
  id: string,
  panelDeviceId: string,
  targetNodeIds: string[],
  extra: Partial<Circuit> = {},
): Circuit {
  return {
    id,
    name: id,
    type: 'sockets',
    panelDeviceId,
    crossSection: 2.5,
    conductors: standardConductors,
    targetNodeIds,
    routing: { mode: 'auto' },
    ...extra,
  };
}

export function extraRun(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  extra: Partial<ExtraConductorRun> = {},
): ExtraConductorRun {
  return {
    id,
    fromNodeId,
    toNodeId,
    conductors: [
      { role: 'traveler', crossSection: 1.5, color: 'black' },
      { role: 'traveler', crossSection: 1.5, color: 'grey' },
    ],
    routing: { mode: 'auto' },
    ...extra,
  };
}

/** Panel with an RCD feeding a 16 A and a 10 A MCB (ids: rcd, mcb16, mcb10). */
export function panel(nodeId: string, extra: Partial<Panel> = {}): Panel {
  return {
    id: 'panel',
    nodeId,
    enclosureItemId: 'builtin:enclosure_12m',
    dinRails: 1,
    modulesPerRail: 12,
    devices: [
      { id: 'rcd', itemId: 'builtin:rcd_2p_40a_30ma_a', rail: 0, slot: 0, label: 'RCD' },
      {
        id: 'mcb16',
        itemId: 'builtin:mcb_1pn_c16',
        rail: 0,
        slot: 2,
        upstreamDeviceId: 'rcd',
        label: 'MCB 16',
      },
      {
        id: 'mcb10',
        itemId: 'builtin:mcb_1pn_c10',
        rail: 0,
        slot: 3,
        upstreamDeviceId: 'rcd',
        label: 'MCB 10',
      },
    ],
    ...extra,
  };
}

export function doc(parts: Partial<ProjectDoc>): ProjectDoc {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    floors: [floor('f0', 0)],
    nodes: [],
    segments: [],
    panels: [],
    circuits: [],
    extraRuns: [],
    ...parts,
  };
}

/**
 * Spec AC 4 reference: panel P (1.50 m) → JB (0.25 m) → socket S (0.30 m), S1 5.00 m and
 * S2 3.00 m plan length, both at floor, 20 mm conduit, one 2.5 mm² L+N+PE circuit to S.
 */
export function ac4Doc(): ProjectDoc {
  return doc({
    nodes: [
      node('P', 'f0', 'panel', 0, 0),
      node('JB', 'f0', 'junction_box', 5, 0, { boxItemId: 'builtin:junction_box_92x92' }),
      node('S', 'f0', 'terminal_box', 5, 3, {
        mounting: 'socket',
        boxItemId: 'builtin:box_503',
        contents: [
          { itemId: 'builtin:socket_10_16', qty: 1 },
          { itemId: 'builtin:blanking_cover', qty: 2 },
          { itemId: 'builtin:plate_3m', qty: 1 },
        ],
      }),
    ],
    segments: [seg('S1', 'P', 'JB'), seg('S2', 'JB', 'S')],
    panels: [panel('P')],
    circuits: [circuit('c1', 'mcb16', ['S'])],
  });
}
