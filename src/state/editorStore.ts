// Editor store: one per open project. Every document change goes through applyCommand,
// which records immer patches for undo/redo.
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SaveErrorCode } from '@/data/types';
import { docIntegrityIssues } from '@/domain/schema';
import type { Point, ProjectDoc, ProjectMeta, ProjectQuote, ProjectSettings } from '@/domain/types';

enablePatches();

/** The undoable part of a project: doc + per-project settings + quote settings. */
export interface EditorData {
  doc: ProjectDoc;
  settings: ProjectSettings;
  quote: ProjectQuote;
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
}

export type Tool =
  | 'select'
  | 'wall'
  | 'calibrate'
  | 'panel'
  | 'junction_box'
  | 'terminal_box'
  | 'riser_point'
  | 'conduit';

export interface EditorUi {
  floorId: string;
  /** Selected element ids (nodes, segments, walls, panel devices). */
  selection: string[];
  tool: Tool;
  /** Canvas view: px per meter and screen offset. */
  view: { scale: number; x: number; y: number };
  /** Box preset applied when placing terminal boxes (null = plain box). */
  presetId: string | null;
  /** Circuit or extra run shown highlighted on the plan and edited in the drawer. */
  activeOwner: { kind: 'circuit' | 'extra'; id: string } | null;
  /** Plan picking mode: clicking boxes toggles targets, clicking segments toggles the manual route. */
  pick: { mode: 'targets' | 'route'; owner: { kind: 'circuit' | 'extra'; id: string } } | null;
  drawerTab: DrawerTab;
  /** Hides connectivity warnings while drawing (presentation only). */
  hideConnectivity: boolean;
  /** World point (m) the plan canvas should center on, consumed by the canvas. */
  focus: Point | null;
}

export type DrawerTab = 'circuits' | 'bom' | 'warnings';

export interface EditorState {
  projectId: string;
  meta: ProjectMeta;
  data: EditorData;
  readOnly: boolean;
  /** Server version the data is based on (expected_version of the next save). */
  version: number;
  /** Increments on every change; compared with savedRevision to know if we are dirty. */
  revision: number;
  savedRevision: number;
  saveStatus: SaveStatus;
  saveError: SaveErrorCode | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  ui: EditorUi;
  applyCommand(label: string, recipe: (draft: Draft<EditorData>) => void): CommandResult;
  undo(): void;
  redo(): void;
  setUi(patch: Partial<EditorUi>): void;
  setMeta(patch: Partial<ProjectMeta>): void;
}

export type CommandResult = { ok: true } | { ok: false; reason: string };

export class CommandError extends Error {
  override name = 'CommandError';
}

const HISTORY_LIMIT = 200;

export interface EditorInit {
  projectId: string;
  meta: ProjectMeta;
  data: EditorData;
  readOnly?: boolean;
}

export type EditorStore = StoreApi<EditorState>;

export function createEditorStore(init: EditorInit): EditorStore {
  const firstFloor = [...init.data.doc.floors].sort((a, b) => a.order - b.order)[0];
  return createStore<EditorState>()((set, get) => {
    const changed = (data: EditorData, history: Partial<Pick<EditorState, 'past' | 'future'>>) => {
      const s = get();
      set({
        data,
        ...history,
        revision: s.revision + 1,
        saveStatus:
          s.saveStatus === 'conflict' ? 'conflict' : s.saveStatus === 'saving' ? 'saving' : 'dirty',
        ui: keepUiValid(s.ui, data.doc),
      });
    };

    return {
      projectId: init.projectId,
      meta: init.meta,
      data: init.data,
      readOnly: init.readOnly ?? false,
      version: init.meta.version,
      revision: 0,
      savedRevision: 0,
      saveStatus: 'saved',
      saveError: null,
      past: [],
      future: [],
      ui: {
        floorId: firstFloor?.id ?? '',
        selection: [],
        tool: 'select',
        view: { scale: 50, x: 80, y: 80 },
        presetId: null,
        activeOwner: null,
        pick: null,
        drawerTab: 'circuits',
        hideConnectivity: false,
        focus: null,
      },

      applyCommand(label, recipe) {
        const s = get();
        if (s.readOnly) return { ok: false, reason: 'read_only' };
        let result: readonly [EditorData, Patch[], Patch[]];
        try {
          result = produceWithPatches(s.data, recipe);
        } catch (e) {
          if (e instanceof CommandError) return { ok: false, reason: e.message };
          throw e;
        }
        const [next, patches, inverse] = result;
        if (patches.length === 0) return { ok: true };
        const issues = docIntegrityIssues(next.doc);
        if (issues.length > 0) return { ok: false, reason: issues[0]!.message };
        changed(next, {
          past: [...s.past, { label, patches, inverse }].slice(-HISTORY_LIMIT),
          future: [],
        });
        return { ok: true };
      },

      undo() {
        const s = get();
        const entry = s.past[s.past.length - 1];
        if (!entry || s.readOnly) return;
        changed(applyPatches(s.data, entry.inverse), {
          past: s.past.slice(0, -1),
          future: [entry, ...s.future],
        });
      },

      redo() {
        const s = get();
        const [entry, ...rest] = s.future;
        if (!entry || s.readOnly) return;
        changed(applyPatches(s.data, entry.patches), { past: [...s.past, entry], future: rest });
      },

      setUi(patch) {
        set({ ui: { ...get().ui, ...patch } });
      },

      setMeta(patch) {
        set({ meta: { ...get().meta, ...patch } });
      },
    };
  });
}

function keepUiValid(ui: EditorUi, doc: ProjectDoc): EditorUi {
  const floorOk = doc.floors.some((f) => f.id === ui.floorId);
  const floorId = floorOk
    ? ui.floorId
    : ([...doc.floors].sort((a, b) => a.order - b.order)[0]?.id ?? '');
  if (floorOk && ui.selection.length === 0) return ui;
  const ids = new Set<string>([
    ...doc.nodes.map((n) => n.id),
    ...doc.segments.map((s) => s.id),
    ...doc.floors.flatMap((f) => f.walls.map((w) => w.id)),
    ...doc.panels.flatMap((p) => p.devices.map((d) => d.id)),
  ]);
  const selection = ui.selection.filter((id) => ids.has(id));
  return floorOk && selection.length === ui.selection.length ? ui : { ...ui, floorId, selection };
}
