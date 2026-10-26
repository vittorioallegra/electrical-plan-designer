// Basic checks: warnings, never blocking. Each carries params for its i18n message.
import { cableOuterDiameters } from './catalog/builtin';
import { isPriceOnly } from './catalog/attributes';
import type { CatalogLookup } from './catalog/lookup';
import { bundleDiameter, conduitTooSmall, estimatedOuterDiameter } from './conduitFill';
import { routeDoc, type RoutingResult } from './routing';
import { MAX_UPSTREAM_DEPTH } from './schema';
import type { Panel, PanelDevice, ProjectDoc, ProjectSettings } from './types';

export type CheckId =
  | 'section_type' // 1
  | 'rating_section' // 2
  | 'no_rcd' // 3
  | 'box_not_reached' // 4
  | 'not_connected' // 5
  | 'conduit_fill' // 6
  | 'box_modules' // 7
  | 'panel_capacity' // 8
  | 'box_empty' // 9
  | 'route_invalid'
  | 'target_unreachable'
  | 'riser_mixed_elevation'
  | 'height_clamped'
  | 'missing_item' // 10
  | 'item_dropped' // 10
  | 'price_only'; // 10

export type ElementRef =
  | { kind: 'circuit' | 'node' | 'segment' | 'extra_run'; id: string }
  | { kind: 'panel_device'; id: string; panelId: string };

export interface Warning {
  id: CheckId;
  severity: 'warning';
  elementRef: ElementRef;
  params: Record<string, string | number>;
}

/** Connectivity warnings, which the checks panel can hide while drawing. */
export const connectivityCheckIds: ReadonlySet<CheckId> = new Set([
  'box_not_reached',
  'not_connected',
  'target_unreachable',
]);

/** Minimum cross-section per circuit type, mm² (check 1). */
export const minSectionByType: Partial<Record<string, number>> = { lighting: 1.5, sockets: 2.5 };

/** Max protective device rating per cross-section, A (check 2). */
export const maxRatingBySection: readonly [section: number, maxA: number][] = [
  [1.5, 10],
  [2.5, 16],
  [4, 25],
  [6, 32],
];

function maxRatingFor(section: number): number | undefined {
  let limit: number | undefined;
  for (const [s, a] of maxRatingBySection) if (section >= s) limit = a;
  // Above the table's largest section there is no limit in v1.
  const largest = maxRatingBySection[maxRatingBySection.length - 1]![0];
  return section > largest ? undefined : limit;
}

export function runChecks(
  doc: ProjectDoc,
  settings: ProjectSettings,
  catalog: CatalogLookup,
  routing: RoutingResult = routeDoc(doc, settings),
): Warning[] {
  const warnings: Warning[] = [];
  const warn = (id: CheckId, elementRef: ElementRef, params: Warning['params'] = {}) =>
    warnings.push({ id, severity: 'warning', elementRef, params });

  const devices = new Map<string, { device: PanelDevice; panel: Panel }>();
  for (const panel of doc.panels)
    for (const device of panel.devices) devices.set(device.id, { device, panel });
  const typeOf = (d: PanelDevice) => catalog(d.itemId)?.attributes.panelDeviceType;

  // Circuits: checks 1–3 and route problems.
  for (const circuit of doc.circuits) {
    const ref = { kind: 'circuit' as const, id: circuit.id };
    const min = minSectionByType[circuit.type];
    if (min !== undefined && circuit.crossSection < min) {
      warn('section_type', ref, {
        name: circuit.name,
        section: circuit.crossSection,
        min,
        type: circuit.type,
      });
    }
    const entry = devices.get(circuit.panelDeviceId);
    const rating = entry ? catalog(entry.device.itemId)?.attributes.ratingA : undefined;
    const limit = maxRatingFor(circuit.crossSection);
    if (rating !== undefined && limit !== undefined && rating > limit) {
      warn('rating_section', ref, {
        name: circuit.name,
        rating,
        section: circuit.crossSection,
        max: limit,
      });
    }
    if (!entry || !hasRcdProtection(entry.device, devices, typeOf)) {
      warn('no_rcd', ref, { name: circuit.name });
    }
    const route = routing.circuitRoutes.get(circuit.id);
    if (route && !route.ok)
      warn('route_invalid', ref, { name: circuit.name, problem: route.problem });
    if (route?.ok && route.unreachableTargetIds.length > 0) {
      warn('target_unreachable', ref, {
        name: circuit.name,
        count: route.unreachableTargetIds.length,
      });
    }
  }
  for (const run of doc.extraRuns) {
    const route = routing.extraRunRoutes.get(run.id);
    if (route && !route.ok)
      warn('route_invalid', { kind: 'extra_run', id: run.id }, { problem: route.problem });
  }

  // Check 4: active terminal boxes reached by a routed circuit.
  const reached = new Set<string>();
  for (const circuit of doc.circuits) {
    const route = routing.circuitRoutes.get(circuit.id);
    if (!route?.ok) continue;
    for (const t of circuit.targetNodeIds)
      if (!route.unreachableTargetIds.includes(t)) reached.add(t);
  }
  for (const n of doc.nodes) {
    if (n.kind === 'terminal_box' && n.status === 'active' && !reached.has(n.id)) {
      warn('box_not_reached', { kind: 'node', id: n.id }, { label: n.label });
    }
  }

  // Check 5: conduit graph connectivity to a panel.
  const connected = new Set<string>();
  const stack = doc.panels.map((p) => p.nodeId).filter((id) => routing.graph.has(id));
  for (const id of stack) connected.add(id);
  while (stack.length > 0) {
    for (const edge of routing.graph.get(stack.pop()!) ?? []) {
      if (!connected.has(edge.other)) {
        connected.add(edge.other);
        stack.push(edge.other);
      }
    }
  }
  for (const n of doc.nodes) {
    if (!connected.has(n.id)) warn('not_connected', { kind: 'node', id: n.id }, { label: n.label });
  }
  for (const s of doc.segments) {
    if (!connected.has(s.fromNodeId) && !connected.has(s.toNodeId)) {
      warn('not_connected', { kind: 'segment', id: s.id }, {});
    }
  }

  // Check 6: conduit fill.
  const cableDiameter = (section: number) =>
    cableOuterDiameters[String(section)] ?? estimatedOuterDiameter(section);
  for (const s of doc.segments) {
    const conductors = routing.occupancy.get(s.id) ?? [];
    if (conductors.length === 0) continue;
    const inner = catalog(s.conduitItemId)?.attributes.innerDiameter;
    if (inner === undefined) continue;
    const bundle = bundleDiameter(conductors.map((c) => cableDiameter(c.crossSection)));
    if (conduitTooSmall(inner, bundle, settings.conduitFillFactor)) {
      warn(
        'conduit_fill',
        { kind: 'segment', id: s.id },
        {
          inner,
          required: Math.round(settings.conduitFillFactor * bundle * 10) / 10,
          conductors: conductors.length,
        },
      );
    }
  }

  // Checks 7 and 9: box contents.
  for (const n of doc.nodes) {
    const contents = n.contents ?? [];
    const box = n.boxItemId ? catalog(n.boxItemId) : undefined;
    const used = contents.reduce((sum, c) => {
      const item = catalog(c.itemId);
      return item && item.category !== 'plate' ? sum + (item.modules ?? 0) * c.qty : sum;
    }, 0);
    if (box?.modules !== undefined && used > box.modules) {
      warn(
        'box_modules',
        { kind: 'node', id: n.id },
        { label: n.label, used, available: box.modules },
      );
    }
    if (n.kind === 'terminal_box' && n.status === 'active') {
      const hasPlateOrDevice = contents.some((c) => {
        const category = catalog(c.itemId)?.category;
        return category === 'plate' || category === 'device';
      });
      if (!hasPlateOrDevice) warn('box_empty', { kind: 'node', id: n.id }, { label: n.label });
    }
  }

  // Check 8: panel capacity and overlaps.
  for (const panel of doc.panels) {
    const spans = panel.devices.map((d) => ({
      d,
      start: d.slot,
      end: d.slot + Math.max(1, catalog(d.itemId)?.modules ?? 1),
    }));
    for (const span of spans) {
      const ref = { kind: 'panel_device' as const, id: span.d.id, panelId: panel.id };
      if (span.d.rail >= panel.dinRails || span.end > panel.modulesPerRail) {
        warn('panel_capacity', ref, { label: span.d.label, reason: 'overflow' });
        continue;
      }
      const overlaps = spans.some(
        (o) => o !== span && o.d.rail === span.d.rail && o.start < span.end && span.start < o.end,
      );
      if (overlaps) warn('panel_capacity', ref, { label: span.d.label, reason: 'overlap' });
    }
  }

  // Data-quality warnings.
  for (const id of routing.ctx.mixedRiserNodeIds) {
    warn('riser_mixed_elevation', { kind: 'node', id }, {});
  }
  for (const id of routing.ctx.clampedNodeIds) warn('height_clamped', { kind: 'node', id }, {});
  // Check 10: items gone from the catalog, dropped by a catalog replace, or price only.
  const missing = (itemId: string | undefined, ref: ElementRef) => {
    if (itemId === undefined) return;
    const item = catalog(itemId);
    if (!item) warn('missing_item', ref, { itemId });
    else if (item.missing) warn('item_dropped', ref, { itemId, item: item.name });
    else if (isPriceOnly(item)) warn('price_only', ref, { itemId, item: item.name });
  };
  for (const n of doc.nodes) {
    missing(n.boxItemId, { kind: 'node', id: n.id });
    for (const c of n.contents ?? []) missing(c.itemId, { kind: 'node', id: n.id });
  }
  for (const s of doc.segments) missing(s.conduitItemId, { kind: 'segment', id: s.id });
  for (const panel of doc.panels) {
    for (const d of panel.devices)
      missing(d.itemId, { kind: 'panel_device', id: d.id, panelId: panel.id });
  }
  return warnings;
}

function hasRcdProtection(
  device: PanelDevice,
  devices: Map<string, { device: PanelDevice }>,
  typeOf: (d: PanelDevice) => string | undefined,
): boolean {
  let current: PanelDevice | undefined = device;
  for (let depth = 0; current && depth <= MAX_UPSTREAM_DEPTH; depth++) {
    const type = typeOf(current);
    if (type === 'rcd' || type === 'rcbo') return true;
    current = current.upstreamDeviceId ? devices.get(current.upstreamDeviceId)?.device : undefined;
  }
  return false;
}
