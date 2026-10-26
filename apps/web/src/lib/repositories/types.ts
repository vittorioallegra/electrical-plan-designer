// Persistence interfaces: the draft of the open project and access to project files.
import type { ProjectFile } from '@epd/domain/projectFile';
import type { ProjectAssets } from '@/lib/projectFile/epd';

export type {
  CloseChoice,
  ExportFilter,
  ExportResult,
  FileStat,
  OpenedFile,
  SaveAsResult,
  SaveResult,
  SavedFile,
  WindowState,
} from '@epd/bridge/bridge';
import type {
  CloseChoice,
  ExportFilter,
  ExportResult,
  FileStat,
  OpenedFile,
  SaveAsResult,
  SaveResult,
  SavedFile,
  WindowState,
} from '@epd/bridge/bridge';

/** The file a project is bound to: the path Save writes and the stat it expects there. */
export type FileBinding = SavedFile;

/** Project files by path: native dialogs and atomic writes in the desktop app. */
export interface FileAccess {
  /** Asks the user for a project file; null when cancelled. Rejects when it cannot be read. */
  open(): Promise<OpenedFile | null>;
  /**
   * Writes the project over `path`. `expected` is the stat from the last open or save; the write
   * is refused with `changed_on_disk` when the file differs. Null overwrites regardless.
   */
  save(path: string, bytes: Uint8Array, expected: FileStat | null): Promise<SaveResult>;
  /** Asks where to save; later saves go to the path in the result. */
  saveAs(suggestedName: string, bytes: Uint8Array): Promise<SaveAsResult>;
  /** Asks where to save a file that is not the project (PDF, CSV, JSON, catalog). */
  exportFile(name: string, blob: Blob, filters: ExportFilter[]): Promise<ExportResult>;
}

/** The app window: its title and the question asked when it closes with unsaved changes. */
export interface WindowHost {
  /** The open project's name and whether it has changes that are not in its file. */
  setState(state: WindowState): void;
  /** The window is closing or the app quitting while the project has unsaved changes. */
  onCloseRequested(listener: () => void): () => void;
  /** The answer to a close request. */
  answerClose(choice: CloseChoice): void;
}

/** The open project as autosave keeps it on this device. */
export interface Draft {
  project: ProjectFile;
  /** Only the assets the project references. */
  assets: ProjectAssets;
  /** True when the last opened or saved file already has every change in the draft. */
  savedToFile: boolean;
  savedAt: string;
}

/** One draft per app: the project open in the tab. */
export interface DraftRepository {
  get(): Promise<Draft | null>;
  save(draft: Draft): Promise<void>;
  clear(): Promise<void>;
}

/** The tab that holds the draft, as other tabs see it. */
export interface DraftHolder {
  /** Name of the project open there. */
  name: string;
  /** It has changes that are not in a file (they would be lost if another tab took over). */
  unsaved: boolean;
}

/** Coordinates the tabs of one browser around the single draft. */
export interface DraftPresence {
  /** The other tab that holds the draft, or null when none answers. */
  holder(): Promise<DraftHolder | null>;
  /** Takes the draft over: the holding tab turns read-only before this resolves. */
  claim(): Promise<void>;
  /** While set, this tab holds the draft and answers other tabs with `info()`. */
  hold(info: (() => DraftHolder) | null): void;
  /** Called when another tab takes the draft over; the claim waits for it to settle. */
  onTakenOver(listener: () => void | Promise<void>): () => void;
}
