// Editor store: one per open project. Every document change goes through applyCommand,
// which records immer patches for undo/redo.
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ProjectFile } from '@epd/domain/projectFile';
import { copyUsedItems, referenceSignature, type LibrarySource } from '@epd/domain/catalog/copies';
import { addIssuedQuote } from '@epd/domain/issuedQuotes';
import { docIntegrityIssues } from '@epd/domain/schema';
import type { IssuedQuote, Point, ProjectDoc } from '@epd/domain/types';
import type { FileBinding } from '@/lib/repositories/types';
import type { ProjectAsset, ProjectAssets } from '@/lib/projectFile/epd';

enablePatches();

/** The undoable part of the open project: the whole project file except its assets. */
export type EditorData = ProjectFile;

/**
 * Where the latest changes are: in a file (opened or saved, `saved`), only in the draft on this
 * device (`draft`), or not stored anywhere yet (`unsaved`).
 */
export type SaveStatus = 'saved' | 'draft' | 'unsaved';

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
  /** Bottom panel (Circuits, BOM, Warnings) open; presentation only, like the rest of `ui`. */
  drawerOpen: boolean;
  /** Height of the open bottom panel, % of the editor area. */
  drawerSize: number;
  /** Plan view side panels (floors and background on the left, inspector on the right) open. */
  leftPanelOpen: boolean;
  inspectorOpen: boolean;
  /** Hides connectivity warnings while drawing (presentation only). */
  hideConnectivity: boolean;
  /** World point (m) the plan canvas should center on, consumed by the canvas. */
  focus: Point | null;
}

export type DrawerTab = 'circuits' | 'bom' | 'warnings';

export interface EditorState {
  data: EditorData;
  /** Asset bytes by id. Kept outside undo/redo; unreferenced ones are left out of saves. */
  assets: ProjectAssets;
  readOnly: boolean;
  /** Increments on every change; compared with the revisions below to get the save status. */
  revision: number;
  /** Revision last written to the draft. */
  draftRevision: number;
  /** Revision the last opened or saved file matches; null when there is none or it is behind. */
  fileRevision: number | null;
  /** The file the project was opened from or last saved to; null for a project never saved. */
  file: FileBinding | null;
  /** The last draft write failed: the changes since draftRevision exist only in this tab. */
  draftFailed: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  ui: EditorUi;
  applyCommand(label: string, recipe: (draft: Draft<EditorData>) => void): CommandResult;
  /**
   * Adds an issued quote outside undo/redo (a number given to a client is never taken back);
   * pending quotes before it become superseded.
   */
  issueQuote(quote: IssuedQuote): CommandResult;
  undo(): void;
  redo(): void;
  setUi(patch: Partial<EditorUi>): void;
  /** Adds an asset (a new background, a logo); a command then references it. */
  addAsset(id: string, asset: ProjectAsset): void;
  /** The data at `revision` was written to `file`, which the project is bound to from now on. */
  markSaved(revision: number, file: FileBinding): void;
}

export type CommandResult = { ok: true } | { ok: false; reason: string };

export class CommandError extends Error {
  override name = 'CommandError';
}

const HISTORY_LIMIT = 200;

export interface EditorInit {
  data: EditorData;
  assets?: ProjectAssets;
  readOnly?: boolean;
  /** Where the opened data already is (default `saved`: it is the content of a file). */
  status?: SaveStatus;
  /** The file the data came from, so Save writes it in place. */
  file?: FileBinding;
}

export function saveStatusOf(
  s: Pick<EditorState, 'revision' | 'draftRevision' | 'fileRevision'>,
): SaveStatus {
  if (s.fileRevision === s.revision) return 'saved';
  return s.draftRevision === s.revision ? 'draft' : 'unsaved';
}

export type EditorStore = StoreApi<EditorState>;

export interface EditorDeps {
  /**
   * The library the project copies its items and cable prices from when a command changes what
   * the drawing uses; without it no copies are made.
   */
  librarySource?: () => LibrarySource;
}

export function createEditorStore(init: EditorInit, deps: EditorDeps = {}): EditorStore {
  const firstFloor = [...init.data.doc.floors].sort((a, b) => a.order - b.order)[0];
  return createStore<EditorState>()((set, get) => {
    const changed = (data: EditorData, history: Partial<Pick<EditorState, 'past' | 'future'>>) => {
      const s = get();
      set({
        data,
        ...history,
        revision: s.revision + 1,
        ui: keepUiValid(s.ui, data.doc),
      });
    };

    return {
      data: init.data,
      assets: init.assets ?? new Map(),
      readOnly: init.readOnly ?? false,
      revision: 0,
      // `unsaved` at open = written nowhere yet: draftRevision -1 makes the first save write it.
      draftRevision: init.status === 'unsaved' ? -1 : 0,
      fileRevision: (init.status ?? 'saved') === 'saved' ? 0 : null,
      file: init.file ?? null,
      draftFailed: false,
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
        drawerOpen: false,
        drawerSize: 30,
        leftPanelOpen: true,
        inspectorOpen: true,
        hideConnectivity: false,
        focus: null,
      },

      applyCommand(label, recipe) {
        const s = get();
        if (s.readOnly) return { ok: false, reason: 'read_only' };
        let result: readonly [EditorData, Patch[], Patch[]];
        try {
          const signature = referenceSignature(s.data.doc);
          result = produceWithPatches(s.data, (draft) => {
            recipe(draft);
            // Copies change in the same patches as the drawing, so undo and redo restore them.
            if (deps.librarySource && referenceSignature(draft.doc) !== signature)
              copyUsedItems(draft, deps.librarySource());
          });
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

      issueQuote(quote) {
        const s = get();
        if (s.readOnly) return { ok: false, reason: 'read_only' };
        const data = { ...s.data, quote: addIssuedQuote(s.data.quote, quote, new Date()) };
        changed(data, {});
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

      addAsset(id, asset) {
        set({ assets: new Map(get().assets).set(id, asset) });
      },

      markSaved(revision, file) {
        set({ fileRevision: revision, file });
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
