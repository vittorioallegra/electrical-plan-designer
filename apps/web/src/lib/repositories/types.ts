// Persistence interfaces: the recovery copy of the open project, project files and the window.
import type { ProjectCatalog } from '@epd/domain/catalog/types';
import type { Library, LibraryCore } from '@epd/domain/library';
import type { ProjectFile } from '@epd/domain/projectFile';
import type { ProjectAssets } from '@/lib/projectFile/epd';

export type {
  CloseChoice,
  ExportFilter,
  ExportResult,
  FileStat,
  LibraryLogo,
  MenuCommand,
  MenuLabels,
  OpenedFile,
  RecentFile,
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
  LibraryLogo,
  MenuCommand,
  MenuLabels,
  OpenedFile,
  RecentFile,
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
  /** Opens a path from the recent list or the OS; null when the file is gone. */
  openPath(path: string): Promise<OpenedFile | null>;
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

/** The recent project files (the desktop app adds a file as it is opened or saved). */
export interface RecentRepository {
  /** Newest first; `missing` for a file that is no longer on disk. */
  list(): Promise<RecentFile[]>;
  remove(path: string): Promise<void>;
}

/** The app window: its title and the question asked when it closes with unsaved changes. */
export interface WindowHost {
  /** The open project's name and whether it has changes that are not in its file. */
  setState(state: WindowState): void;
  /** The window is closing or the app quitting while the project has unsaved changes. */
  onCloseRequested(listener: () => void): () => void;
  /** The answer to a close request. */
  answerClose(choice: CloseChoice): void;
  /** Gives the native menu its texts in the app's language. */
  setMenuLabels(labels: MenuLabels): void;
  /** The user chose a native menu item. */
  onMenuCommand(listener: (command: MenuCommand) => void): () => void;
  /** The OS asks to open a project file (double-click, a second launch). */
  onOpenRequest(listener: (path: string) => void): () => void;
}

/** The open project as autosave keeps it in the recovery copy. */
export interface RecoveryCopy {
  project: ProjectFile;
  /** Only the assets the project references. */
  assets: ProjectAssets;
  /** The file the project was bound to, so a restored project saves back to the same path. */
  file: FileBinding | null;
  /** True when the file already has every change in the copy. */
  savedToFile: boolean;
  savedAt: string;
}

/** One recovery copy per app: the project open in the window. */
export interface RecoveryRepository {
  /** The copy a previous run left, or null (none, or one that is not a valid project). */
  get(): Promise<RecoveryCopy | null>;
  save(copy: RecoveryCopy): Promise<void>;
  clear(): Promise<void>;
}

/** The library and its logo: everything the library stores. */
export interface LibraryData {
  library: Library;
  logo: LibraryLogo | null;
}

/** The library files of the app, one write per changed part (the desktop app: files in userData). */
export interface LibraryRepository {
  /**
   * The stored library. A part that failed validation was set aside and comes back as defaults;
   * `invalid` names the files that were set aside.
   */
  load(): Promise<LibraryData & { invalid: string[] }>;
  /** Everything but the catalogs. */
  saveCore(core: LibraryCore): Promise<void>;
  saveCatalog(catalog: ProjectCatalog): Promise<void>;
  removeCatalog(id: string): Promise<void>;
  setLogo(logo: LibraryLogo | null): Promise<void>;
  /** Replaces the whole library; the old one is kept as a backup. */
  replace(data: LibraryData): Promise<void>;
}
