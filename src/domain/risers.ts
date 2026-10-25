// Riser segments are derived from riser points: points of one riserGroupId on adjacent
// floors (by order) are linked by exactly one riser segment.
import { DEFAULT_CONDUIT_ID } from './catalog/builtin';
import type { IdGenerator } from './ids';
import type { ConduitSegment, ProjectDoc } from './types';

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Brings riser segments in line with the riser points (mutates `doc`, draft-safe): removes
 * riser segments whose ends are no longer adjacent points of one group, creates the missing
 * ones. Returns the removed segment ids (manual routes using them become invalid).
 */
export function rebuildRisers(doc: ProjectDoc, genId: IdGenerator): string[] {
  const floorRank = new Map(
    [...doc.floors].sort((a, b) => a.order - b.order).map((f, i) => [f.id, i]),
  );
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));

  const wanted = new Map<string, [string, string]>();
  const groups = new Map<string, { id: string; rank: number }[]>();
  for (const n of doc.nodes) {
    if (n.kind !== 'riser_point' || n.riserGroupId === undefined) continue;
    const rank = floorRank.get(n.floorId);
    if (rank === undefined) continue;
    const list = groups.get(n.riserGroupId) ?? [];
    list.push({ id: n.id, rank });
    groups.set(n.riserGroupId, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
    for (let i = 1; i < list.length; i++) {
      const lower = list[i - 1]!;
      const upper = list[i]!;
      if (upper.rank - lower.rank === 1)
        wanted.set(pairKey(lower.id, upper.id), [lower.id, upper.id]);
    }
  }

  const removed: string[] = [];
  const kept = new Set<string>();
  const conduitByGroup = new Map<string, string>();
  doc.segments = doc.segments.filter((s) => {
    const a = nodes.get(s.fromNodeId);
    const b = nodes.get(s.toNodeId);
    if (!a || !b || a.floorId === b.floorId) return true; // not a riser
    const key = pairKey(a.id, b.id);
    if (wanted.has(key) && !kept.has(key)) {
      kept.add(key);
      return true;
    }
    if (a.riserGroupId) conduitByGroup.set(a.riserGroupId, s.conduitItemId);
    removed.push(s.id);
    return false;
  });

  for (const [key, [lower, upper]] of wanted) {
    if (kept.has(key)) continue;
    const group = nodes.get(lower)!.riserGroupId!;
    const segment: ConduitSegment = {
      id: genId(),
      fromNodeId: lower,
      toNodeId: upper,
      vertices: [],
      conduitItemId: conduitByGroup.get(group) ?? DEFAULT_CONDUIT_ID,
      runElevation: 'floor',
    };
    doc.segments.push(segment);
  }
  return removed;
}
