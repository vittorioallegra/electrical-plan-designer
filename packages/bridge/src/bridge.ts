/**
 * The IPC contract between the Electron main process, the preload script and the web app.
 * Types and channel names only: no runtime code, no imports from the app.
 */

/** What identifies a version of a file on disk; a Save is refused when it no longer matches. */
export interface FileStat {
  mtimeMs: number;
  size: number;
}

/** A project file the user picked. */
export interface OpenedFile {
  path: string;
  name: string;
  bytes: Uint8Array;
  stat: FileStat;
}

/** A file main wrote: the path the project is bound to and the stat Save expects next. */
export interface SavedFile {
  path: string;
  name: string;
  stat: FileStat;
}

/** `code` is the OS error code (`EACCES`, `ENOSPC`, `ENOENT`, ...) of a failed write. */
export type SaveResult =
  | ({ status: 'saved' } & SavedFile)
  | { status: 'changed_on_disk' }
  | { status: 'failed'; code: string };

export type SaveAsResult =
  ({ status: 'saved' } & SavedFile) | { status: 'cancelled' } | { status: 'failed'; code: string };

export type ExportResult =
  { status: 'saved'; path: string } | { status: 'cancelled' } | { status: 'failed'; code: string };

/** A file type of the save dialog, e.g. `{ name: 'PDF', extensions: ['pdf'] }`. */
export interface ExportFilter {
  name: string;
  extensions: string[];
}

/** What the window title and the close guard need to know about the open project. */
export interface WindowState {
  /** Name of the open project; null when none is open. */
  name: string | null;
  /** The project has changes that are not in its file. */
  unsaved: boolean;
}

/** The answer to a close request: close the window anyway, or keep it open. */
export type CloseChoice = 'close' | 'cancel';

export type Unsubscribe = () => void;

/** An asset (background image or PDF) of the open project; `id` is its id in the project. */
export interface RecoveryAsset {
  id: string;
  mimeType: string;
}

/** What autosave keeps of the open project in the recovery copy (besides the asset bytes). */
export interface RecoveryMeta {
  /** The file the project is bound to, so a restored project saves back to the same path. */
  file: SavedFile | null;
  /** The file already has every change in the copy. */
  savedToFile: boolean;
  savedAt: string;
  /** Every asset the project references; main prunes the others. */
  assets: RecoveryAsset[];
}

export interface RecoverySaveArgs {
  /** The project as JSON text; main stores it without reading it. */
  project: string;
  meta: RecoveryMeta;
  /** Bytes of the assets main does not have yet (each id is written once). */
  newAssets: { id: string; bytes: Uint8Array }[];
}

export interface RecoverySnapshot {
  project: string;
  meta: RecoveryMeta;
  /** Bytes of the assets main still has; the others are missing. */
  assets: { id: string; bytes: Uint8Array }[];
}

/** A project file in the recent list; `missing` when it is no longer on disk. */
export interface RecentFile {
  path: string;
  name: string;
  missing: boolean;
}

/** The app's colour theme: follow the OS, or force light or dark. */
export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferences)[number];

/** The company logo of the library: a PNG or JPEG file. */
export interface LibraryLogo {
  mimeType: 'image/png' | 'image/jpeg';
  bytes: Uint8Array;
}

/**
 * The library as main found it. `library` is JSON main already validated (the renderer validates
 * it again); a part that failed validation is absent (defaults) and listed in `invalid`.
 */
export interface LibrarySnapshot {
  library: unknown;
  logo: LibraryLogo | null;
  /** Files main set aside because they were invalid, as the names they were renamed to. */
  invalid: string[];
}

/** A whole library to store in place of the current one (an imported `.epl`). */
export interface LibraryReplacement {
  library: unknown;
  logo: LibraryLogo | null;
}

/** The menu texts main cannot know: the renderer sends them in the app's language. */
export const menuLabelKeys = [
  'file',
  'new',
  'open',
  'openRecent',
  'noRecent',
  'missing',
  'save',
  'saveAs',
  'export',
  'exportPdf',
  'exportJson',
  'importJson',
  'settings',
  'close',
  'edit',
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'selectAll',
  'view',
  'zoomIn',
  'zoomOut',
  'resetZoom',
  'fullScreen',
  'help',
  'about',
  'version',
] as const;

export type MenuLabelKey = (typeof menuLabelKeys)[number];
export type MenuLabels = Record<MenuLabelKey, string>;

/** A menu item the user chose; the renderer runs the matching in-app action. */
export type MenuCommand =
  | {
      command:
        | 'new'
        | 'open'
        | 'save'
        | 'saveAs'
        | 'close'
        | 'undo'
        | 'redo'
        | 'settings'
        | 'exportPdf'
        | 'exportJson'
        | 'importJson';
    }
  | { command: 'openRecent'; path: string };

/** The API the preload script exposes to the renderer as `window.epd`. Grows with each step. */
export interface EpdBridge {
  files: {
    /** Native open dialog; null when cancelled. Rejects when the file cannot be read. */
    open(): Promise<OpenedFile | null>;
    /**
     * Opens a path from the recent list or one the OS asked to open; null when the file is gone.
     * Main refuses any other path. Rejects when the file cannot be read.
     */
    openPath(path: string): Promise<OpenedFile | null>;
    /**
     * The OS asked to open a project file (double-click, a second launch). Subscribing also tells
     * main the page is ready: requests that came earlier (at launch) are delivered then.
     */
    onOpenRequest(listener: (path: string) => void): Unsubscribe;
    /**
     * Writes over `path` (a path main handed out) atomically. `expected` is the stat from the
     * last open or save; null overwrites whatever is on disk.
     */
    save(path: string, bytes: Uint8Array, expected: FileStat | null): Promise<SaveResult>;
    /** Native save dialog, then an atomic write; later saves go to the returned path. */
    saveAs(suggestedName: string, bytes: Uint8Array): Promise<SaveAsResult>;
    /** Native save dialog and an atomic write of a file that is not the project (PDF, CSV...). */
    exportFile(name: string, bytes: Uint8Array, filters: ExportFilter[]): Promise<ExportResult>;
  };
  recent: {
    /** The last opened or saved project files, newest first (main adds them as they are used). */
    list(): Promise<RecentFile[]>;
    remove(path: string): Promise<void>;
  };
  menu: {
    /** Sets the native menu's texts (at startup and when the language changes). */
    setLabels(labels: MenuLabels): void;
    onCommand(listener: (command: MenuCommand) => void): Unsubscribe;
  };
  recovery: {
    /** Replaces the recovery copy (atomic: a crash mid-write leaves the previous copy readable). */
    save(args: RecoverySaveArgs): Promise<void>;
    /** The copy left by a previous run, or null. Its file's path may be written by Save again. */
    load(): Promise<RecoverySnapshot | null>;
    /** Deletes the recovery copy. */
    clear(): Promise<void>;
  };
  library: {
    /**
     * Reads the library files. A file that fails validation is renamed `<name>.invalid-<time>`
     * (never overwritten) and that part comes back as defaults.
     */
    load(): Promise<LibrarySnapshot>;
    /** Writes `library.json` (everything but the catalogs). */
    saveCore(core: unknown): Promise<void>;
    /** Writes `catalogs/<id>.json`. */
    saveCatalog(catalog: unknown): Promise<void>;
    removeCatalog(id: string): Promise<void>;
    /** Writes or removes the logo file. */
    setLogo(logo: LibraryLogo | null): Promise<void>;
    /**
     * Replaces the whole library after validating it; the old files are first copied to
     * `library.backup-<time>/` in the app data folder.
     */
    replace(replacement: LibraryReplacement): Promise<void>;
  };
  preferences: {
    /** The stored theme preference (`system` until the user picks one). */
    getTheme(): Promise<ThemePreference>;
    /** Stores the preference and applies it to the whole app; every window is told. */
    setTheme(theme: ThemePreference): Promise<void>;
    /** The preference changed (from any window), so a control showing it does not go stale. */
    onThemeChanged(listener: (theme: ThemePreference) => void): Unsubscribe;
  };
  window: {
    /** Tells main the open project's name and whether it has unsaved changes. */
    setState(state: WindowState): void;
    /** Main asks to close or quit while the project has unsaved changes. */
    onCloseRequested(listener: () => void): Unsubscribe;
    /** Tells main the renderer got the request and shows the question. */
    ackClose(): void;
    /** The user's answer; `close` closes the window, `cancel` keeps it open. */
    answerClose(choice: CloseChoice): void;
  };
}

/** IPC channel names shared by main and preload. Grows with each step. */
export const channels = {
  filesOpen: 'files:open',
  filesSave: 'files:save',
  filesSaveAs: 'files:save-as',
  filesExport: 'files:export',
  filesOpenPath: 'files:open-path',
  openRequest: 'files:open-request',
  openRequestReady: 'files:open-request-ready',
  recentList: 'recent:list',
  recentRemove: 'recent:remove',
  menuLabels: 'menu:labels',
  menuCommand: 'menu:command',
  recoverySave: 'recovery:save',
  recoveryLoad: 'recovery:load',
  recoveryClear: 'recovery:clear',
  libraryLoad: 'library:load',
  librarySaveCore: 'library:save-core',
  librarySaveCatalog: 'library:save-catalog',
  libraryRemoveCatalog: 'library:remove-catalog',
  librarySetLogo: 'library:set-logo',
  libraryReplace: 'library:replace',
  preferencesGetTheme: 'preferences:get-theme',
  preferencesSetTheme: 'preferences:set-theme',
  preferencesThemeChanged: 'preferences:theme-changed',
  windowState: 'window:state',
  closeRequested: 'window:close-requested',
  closeAck: 'window:close-ack',
  closeAnswer: 'window:close-answer',
} as const;

declare global {
  interface Window {
    /** Present only inside the desktop app. */
    epd?: EpdBridge;
  }
}
