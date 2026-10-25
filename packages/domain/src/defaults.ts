import { newId, type IdGenerator } from './ids';
import { CURRENT_SCHEMA_VERSION } from './schema';
import type { Floor, ProjectDoc, ProjectSettings, QuoteSettings } from './types';

export function defaultProjectSettings(): ProjectSettings {
  return {
    mountingHeights: { socket: 0.3, switch: 1.1, junctionBox: 0.25, panel: 1.5 },
    defaultFloorHeight: 2.7,
    defaultRunElevation: 'floor',
    terminationSlack: 0.2,
    wastePercent: 10,
    conduitFillFactor: 1.3,
  };
}

export function defaultQuoteSettings(): QuoteSettings {
  return { materialAdjustmentPercent: 0, vatPercent: 22, laborLines: [] };
}

export function newFloor(
  name: string,
  order: number,
  settings: ProjectSettings,
  genId: IdGenerator = newId,
): Floor {
  return { id: genId(), name, order, height: settings.defaultFloorHeight, walls: [] };
}

/** A new project's document: one floor, nothing drawn. */
export function newProjectDoc(
  firstFloorName: string,
  settings: ProjectSettings,
  genId: IdGenerator = newId,
): ProjectDoc {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    floors: [newFloor(firstFloorName, 0, settings, genId)],
    nodes: [],
    segments: [],
    panels: [],
    circuits: [],
    extraRuns: [],
  };
}
