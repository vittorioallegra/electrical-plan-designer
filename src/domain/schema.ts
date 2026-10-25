// Zod schema of the project document (projects.doc) and the per-project settings.
import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 1;

const id = z.string().min(1);
const finite = z.number().finite();
const positive = finite.positive();
const nonNegative = finite.nonnegative();

export const pointSchema = z.object({ x: finite, y: finite });

export const runElevationSchema = z.enum(['floor', 'ceiling', 'direct']);
export const cableColorSchema = z.enum([
  'brown',
  'blue',
  'yellow_green',
  'black',
  'grey',
  'red',
  'white',
  'orange',
  'violet',
  'pink',
]);

export const projectSettingsSchema = z.object({
  mountingHeights: z.object({
    socket: nonNegative,
    switch: nonNegative,
    junctionBox: nonNegative,
    panel: nonNegative,
  }),
  defaultFloorHeight: positive,
  defaultRunElevation: z.enum(['floor', 'ceiling']),
  terminationSlack: nonNegative,
  wastePercent: nonNegative,
  conduitFillFactor: positive,
});

export const laborLineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lump'), description: z.string(), amount: finite }),
  z.object({
    kind: z.literal('hourly'),
    description: z.string(),
    hours: nonNegative,
    hourlyRate: finite,
  }),
]);

export const quoteSettingsSchema = z.object({
  materialAdjustmentPercent: finite,
  vatPercent: nonNegative,
  laborLines: z.array(laborLineSchema),
});

export const calibrationSchema = z.object({
  p1: pointSchema,
  p2: pointSchema,
  realDistance: positive,
});

export const backgroundSchema = z.object({
  storagePath: z.string().min(1),
  kind: z.enum(['pdf', 'image']),
  page: z.number().int().positive().optional(),
  widthPx: positive,
  heightPx: positive,
  calibration: calibrationSchema.optional(),
  offset: pointSchema,
  rotation: finite,
  opacity: z.number().min(0).max(1),
});

export const wallSchema = z.object({ id, a: pointSchema, b: pointSchema, thickness: positive });

export const floorSchema = z.object({
  id,
  name: z.string(),
  order: z.number().int(),
  height: positive,
  background: backgroundSchema.optional(),
  walls: z.array(wallSchema),
});

export const nodeKindSchema = z.enum(['panel', 'junction_box', 'terminal_box', 'riser_point']);
export const mountingSchema = z.enum(['socket', 'switch', 'ceiling', 'custom']);

export const contentLineSchema = z.object({ itemId: id, qty: z.number().int().positive() });

export const planNodeSchema = z.object({
  id,
  floorId: id,
  kind: nodeKindSchema,
  position: pointSchema,
  label: z.string(),
  mounting: mountingSchema.optional(),
  customHeight: nonNegative.optional(),
  boxItemId: id.optional(),
  contents: z.array(contentLineSchema).optional(),
  status: z.enum(['active', 'provision']),
  riserGroupId: id.optional(),
});

export const conduitSegmentSchema = z.object({
  id,
  fromNodeId: id,
  toNodeId: id,
  vertices: z.array(pointSchema),
  conduitItemId: id,
  runElevation: runElevationSchema,
});

export const panelDeviceSchema = z.object({
  id,
  itemId: id,
  rail: z.number().int().nonnegative(),
  slot: z.number().int().nonnegative(),
  upstreamDeviceId: id.optional(),
  label: z.string(),
});

export const panelSchema = z.object({
  id,
  nodeId: id,
  enclosureItemId: id.optional(),
  dinRails: z.number().int().positive(),
  modulesPerRail: z.number().int().positive(),
  devices: z.array(panelDeviceSchema),
});

export const routingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({ mode: z.literal('manual'), segmentIds: z.array(id) }),
]);

export const circuitConductorSchema = z.object({
  role: z.enum(['L', 'N', 'PE']),
  color: cableColorSchema,
});

export const circuitSchema = z.object({
  id,
  name: z.string(),
  type: z.enum(['lighting', 'sockets', 'dedicated', 'other']),
  panelDeviceId: id,
  crossSection: positive,
  conductors: z.array(circuitConductorSchema),
  targetNodeIds: z.array(id),
  routing: routingSchema,
});

export const extraConductorSchema = z.object({
  role: z.enum(['traveler', 'return', 'other']),
  crossSection: positive,
  color: cableColorSchema,
});

export const extraConductorRunSchema = z.object({
  id,
  circuitId: id.optional(),
  fromNodeId: id,
  toNodeId: id,
  conductors: z.array(extraConductorSchema),
  routing: routingSchema,
});

/** Max depth when walking `upstreamDeviceId` chains (guards against cycles and junk data). */
export const MAX_UPSTREAM_DEPTH = 32;

export const projectDocBaseSchema = z.object({
  schemaVersion: z.number().int().positive(),
  floors: z.array(floorSchema),
  nodes: z.array(planNodeSchema),
  segments: z.array(conduitSegmentSchema),
  panels: z.array(panelSchema),
  circuits: z.array(circuitSchema),
  extraRuns: z.array(extraConductorRunSchema),
});

type DocShape = z.infer<typeof projectDocBaseSchema>;

/** Structural problems that commands must also reject; returned as path + message. */
export function docIntegrityIssues(
  doc: DocShape,
): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];
  const unique = (list: { id: string }[], name: string) => {
    const seen = new Set<string>();
    list.forEach((x, i) => {
      if (seen.has(x.id)) issues.push({ path: [name, i, 'id'], message: `duplicate id ${x.id}` });
      seen.add(x.id);
    });
  };
  unique(doc.floors, 'floors');
  unique(doc.nodes, 'nodes');
  unique(doc.segments, 'segments');
  unique(doc.panels, 'panels');
  unique(doc.circuits, 'circuits');
  unique(doc.extraRuns, 'extraRuns');

  const floorIds = new Set(doc.floors.map((f) => f.id));
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  doc.nodes.forEach((n, i) => {
    if (!floorIds.has(n.floorId))
      issues.push({ path: ['nodes', i, 'floorId'], message: `unknown floor ${n.floorId}` });
  });

  doc.segments.forEach((s, i) => {
    if (s.fromNodeId === s.toNodeId) {
      issues.push({ path: ['segments', i], message: 'segment from a node to itself' });
      return;
    }
    const a = nodes.get(s.fromNodeId);
    const b = nodes.get(s.toNodeId);
    if (!a || !b) {
      issues.push({ path: ['segments', i], message: 'segment references an unknown node' });
      return;
    }
    if (a.floorId !== b.floorId) {
      const riser =
        a.kind === 'riser_point' &&
        b.kind === 'riser_point' &&
        a.riserGroupId !== undefined &&
        a.riserGroupId === b.riserGroupId;
      if (!riser)
        issues.push({ path: ['segments', i], message: 'non-riser segment between floors' });
    }
  });

  doc.extraRuns.forEach((r, i) => {
    if (r.fromNodeId === r.toNodeId)
      issues.push({ path: ['extraRuns', i], message: 'extra run from a node to itself' });
  });

  doc.panels.forEach((p, pi) => {
    const byId = new Map(p.devices.map((d) => [d.id, d]));
    p.devices.forEach((d, di) => {
      if (d.upstreamDeviceId !== undefined && !byId.has(d.upstreamDeviceId)) {
        issues.push({
          path: ['panels', pi, 'devices', di, 'upstreamDeviceId'],
          message: 'unknown upstream device',
        });
      }
      if (hasUpstreamCycle(byId, d.id)) {
        issues.push({
          path: ['panels', pi, 'devices', di, 'upstreamDeviceId'],
          message: 'upstream cycle',
        });
      }
    });
  });
  return issues;
}

export function hasUpstreamCycle(
  devices: Map<string, { upstreamDeviceId?: string | undefined }>,
  startId: string,
): boolean {
  const seen = new Set<string>([startId]);
  let current = devices.get(startId)?.upstreamDeviceId;
  for (let depth = 0; current !== undefined; depth++) {
    if (seen.has(current) || depth > MAX_UPSTREAM_DEPTH) return true;
    seen.add(current);
    current = devices.get(current)?.upstreamDeviceId;
  }
  return false;
}

export const projectDocSchema = projectDocBaseSchema.superRefine((doc, ctx) => {
  for (const issue of docIntegrityIssues(doc)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});
