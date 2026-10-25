// Conduit graph routing: which segments each circuit / extra run occupies.
import { createLengthContext, type LengthContext } from './lengths';
import type {
  CableColor,
  Circuit,
  ExtraConductorRun,
  PlanNode,
  ProjectDoc,
  ProjectSettings,
  Routing,
} from './types';

interface Edge {
  segmentId: string;
  other: string;
  lengthMm: number;
}

export type Graph = Map<string, Edge[]>;

/** Undirected graph: nodes = plan nodes, edges = segments weighted by length (risers included). */
export function buildGraph(doc: ProjectDoc, ctx: LengthContext): Graph {
  const graph: Graph = new Map(doc.nodes.map((n) => [n.id, []]));
  const segments = [...doc.segments].sort((a, b) => cmp(a.id, b.id));
  for (const s of segments) {
    const a = graph.get(s.fromNodeId);
    const b = graph.get(s.toNodeId);
    if (!a || !b || s.fromNodeId === s.toNodeId) continue;
    const lengthMm = ctx.segmentLengthMm(s);
    a.push({ segmentId: s.id, other: s.toNodeId, lengthMm });
    b.push({ segmentId: s.id, other: s.fromNodeId, lengthMm });
  }
  return graph;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface ShortestPathTree {
  distMm: Map<string, number>;
  /** Segment used to reach each node from the source. */
  via: Map<string, { segmentId: string; from: string }>;
}

/**
 * Single-source Dijkstra. Ties are broken by segment id (then node id), so the tree is
 * the same across renders and machines whatever the order of the doc arrays.
 */
export function shortestPathTree(graph: Graph, source: string): ShortestPathTree {
  const distMm = new Map<string, number>([[source, 0]]);
  const via = new Map<string, { segmentId: string; from: string }>();
  const done = new Set<string>();
  if (!graph.has(source)) return { distMm, via };
  for (;;) {
    let current: string | undefined;
    let best = Infinity;
    for (const [id, d] of distMm) {
      if (done.has(id)) continue;
      if (d < best || (d === best && current !== undefined && cmp(id, current) < 0)) {
        best = d;
        current = id;
      }
    }
    if (current === undefined) break;
    done.add(current);
    for (const edge of graph.get(current) ?? []) {
      if (done.has(edge.other)) continue;
      const next = best + edge.lengthMm;
      const known = distMm.get(edge.other);
      const prev = via.get(edge.other);
      if (
        known === undefined ||
        next < known ||
        (next === known && prev !== undefined && cmp(edge.segmentId, prev.segmentId) < 0)
      ) {
        distMm.set(edge.other, next);
        via.set(edge.other, { segmentId: edge.segmentId, from: current });
      }
    }
  }
  return { distMm, via };
}

export type RouteProblem =
  'no_source' | 'missing_segment' | 'unreached_target' | 'cycle' | 'dead_end';

export type RouteResult =
  | {
      ok: true;
      /** Sorted segment ids the route occupies (each once). */
      segmentIds: string[];
      /** Auto routing: targets with no conduit path from the source (reported, not routed). */
      unreachableTargetIds: string[];
    }
  | {
      ok: false;
      problem: RouteProblem;
      segmentIds?: string[];
      nodeIds?: string[];
    };

/** Union of the shortest-path-tree branches from `source` to every target. */
export function autoRoute(graph: Graph, source: string, targets: string[]): RouteResult {
  if (!graph.has(source)) return { ok: false, problem: 'no_source' };
  const tree = shortestPathTree(graph, source);
  const used = new Set<string>();
  const unreachable: string[] = [];
  for (const target of targets) {
    if (!tree.distMm.has(target)) {
      unreachable.push(target);
      continue;
    }
    let node = target;
    while (node !== source) {
      const step = tree.via.get(node)!;
      if (used.has(step.segmentId)) break; // the rest of this branch is already in the union
      used.add(step.segmentId);
      node = step.from;
    }
  }
  return { ok: true, segmentIds: [...used].sort(cmp), unreachableTargetIds: unreachable };
}

/**
 * A manual route is valid when its segments form one tree containing the source and every
 * target, whose leaves are all the source or targets.
 */
export function validateManualRoute(
  doc: ProjectDoc,
  segmentIds: string[],
  source: string,
  targets: string[],
): RouteResult {
  const byId = new Map(doc.segments.map((s) => [s.id, s]));
  const ids = [...new Set(segmentIds)].sort(cmp);
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) return { ok: false, problem: 'missing_segment', segmentIds: missing };

  const adjacency = new Map<string, { segmentId: string; other: string }[]>();
  const link = (a: string, b: string, segmentId: string) => {
    const list = adjacency.get(a) ?? [];
    list.push({ segmentId, other: b });
    adjacency.set(a, list);
  };
  for (const id of ids) {
    const s = byId.get(id)!;
    link(s.fromNodeId, s.toNodeId, id);
    link(s.toNodeId, s.fromNodeId, id);
  }

  // Walk from the source; any back edge to a visited node is a cycle.
  const reached = new Set<string>();
  const usedSegments = new Set<string>();
  const cycleSegments: string[] = [];
  if (adjacency.has(source)) {
    reached.add(source);
    const stack = [source];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const edge of adjacency.get(current) ?? []) {
        if (usedSegments.has(edge.segmentId)) continue;
        usedSegments.add(edge.segmentId);
        if (reached.has(edge.other)) {
          cycleSegments.push(edge.segmentId);
          continue;
        }
        reached.add(edge.other);
        stack.push(edge.other);
      }
    }
  }

  const unreached = targets.filter((t) => t !== source && !reached.has(t));
  if (unreached.length > 0) return { ok: false, problem: 'unreached_target', nodeIds: unreached };
  if (cycleSegments.length > 0)
    return { ok: false, problem: 'cycle', segmentIds: cycleSegments.sort(cmp) };

  const detached = ids.filter((id) => !usedSegments.has(id));
  const endpoints = new Set([source, ...targets]);
  const deadEnds = [...adjacency]
    .filter(([nodeId, edges]) => edges.length === 1 && !endpoints.has(nodeId))
    .map(([, edges]) => edges[0]!.segmentId);
  const bad = [...new Set([...detached, ...deadEnds])].sort(cmp);
  if (bad.length > 0) return { ok: false, problem: 'dead_end', segmentIds: bad };

  return { ok: true, segmentIds: ids, unreachableTargetIds: [] };
}

function routeOwner(
  doc: ProjectDoc,
  graph: Graph,
  routing: Routing,
  source: string | undefined,
  targets: string[],
): RouteResult {
  if (source === undefined) return { ok: false, problem: 'no_source' };
  return routing.mode === 'auto'
    ? autoRoute(graph, source, targets)
    : validateManualRoute(doc, routing.segmentIds, source, targets);
}

/** Panel node feeding a circuit: the panel holding its device (or the only panel). */
export function circuitSourceNodeId(doc: ProjectDoc, circuit: Circuit): string | undefined {
  const panel =
    doc.panels.find((p) => p.devices.some((d) => d.id === circuit.panelDeviceId)) ??
    (doc.panels.length === 1 ? doc.panels[0] : undefined);
  return panel?.nodeId;
}

export interface OccupyingConductor {
  owner: { kind: 'circuit' | 'extra'; id: string };
  role: string;
  crossSection: number;
  color: CableColor;
}

export interface RoutingResult {
  ctx: LengthContext;
  graph: Graph;
  circuitRoutes: Map<string, RouteResult>;
  extraRunRoutes: Map<string, RouteResult>;
  /** Conductors in each segment (derived, never stored). */
  occupancy: Map<string, OccupyingConductor[]>;
}

export function routeDoc(doc: ProjectDoc, settings: ProjectSettings): RoutingResult {
  const ctx = createLengthContext(doc, settings);
  const graph = buildGraph(doc, ctx);
  const occupancy = new Map<string, OccupyingConductor[]>(doc.segments.map((s) => [s.id, []]));
  const circuitRoutes = new Map<string, RouteResult>();
  const extraRunRoutes = new Map<string, RouteResult>();

  for (const circuit of doc.circuits) {
    const route = routeOwner(
      doc,
      graph,
      circuit.routing,
      circuitSourceNodeId(doc, circuit),
      circuit.targetNodeIds,
    );
    circuitRoutes.set(circuit.id, route);
    if (!route.ok) continue;
    for (const segmentId of route.segmentIds) {
      occupancy.get(segmentId)?.push(
        ...circuit.conductors.map((c) => ({
          owner: { kind: 'circuit' as const, id: circuit.id },
          role: c.role,
          crossSection: circuit.crossSection,
          color: c.color,
        })),
      );
    }
  }

  for (const run of doc.extraRuns) {
    const route = routeOwner(doc, graph, run.routing, run.fromNodeId, [run.toNodeId]);
    extraRunRoutes.set(run.id, route);
    if (!route.ok) continue;
    for (const segmentId of route.segmentIds) {
      occupancy.get(segmentId)?.push(...extraConductors(run));
    }
  }
  return { ctx, graph, circuitRoutes, extraRunRoutes, occupancy };
}

function extraConductors(run: ExtraConductorRun): OccupyingConductor[] {
  return run.conductors.map((c) => ({
    owner: { kind: 'extra', id: run.id },
    role: c.role,
    crossSection: c.crossSection,
    color: c.color,
  }));
}

export function occupancy(
  doc: ProjectDoc,
  settings: ProjectSettings,
): Map<string, OccupyingConductor[]> {
  return routeDoc(doc, settings).occupancy;
}

/**
 * Splits a segment at a new node (mutates `doc`, safe on an immer draft). The first
 * `verticesBefore` vertices stay on the first half. Manual routes using the segment get
 * both halves, so they stay valid.
 */
export function splitSegment(
  doc: ProjectDoc,
  segmentId: string,
  newNode: PlanNode,
  verticesBefore: number,
  newSegmentIds: [string, string],
): void {
  const index = doc.segments.findIndex((s) => s.id === segmentId);
  const segment = doc.segments[index];
  if (!segment) throw new Error(`unknown segment ${segmentId}`);
  const from = doc.nodes.find((n) => n.id === segment.fromNodeId);
  if (!from || from.floorId !== newNode.floorId) throw new Error('split node on another floor');
  doc.nodes.push(newNode);
  const [firstId, secondId] = newSegmentIds;
  const first = {
    ...segment,
    id: firstId,
    toNodeId: newNode.id,
    vertices: segment.vertices.slice(0, verticesBefore),
  };
  const second = {
    ...segment,
    id: secondId,
    fromNodeId: newNode.id,
    vertices: segment.vertices.slice(verticesBefore),
  };
  doc.segments.splice(index, 1, first, second);
  for (const owner of [...doc.circuits, ...doc.extraRuns]) {
    if (owner.routing.mode !== 'manual' || !owner.routing.segmentIds.includes(segmentId)) continue;
    owner.routing.segmentIds = owner.routing.segmentIds.flatMap((id) =>
      id === segmentId ? [firstId, secondId] : [id],
    );
  }
}
