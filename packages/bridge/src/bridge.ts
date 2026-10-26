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

/** The API the preload script exposes to the renderer as `window.epd`. Grows with each step. */
export interface EpdBridge {
  files: {
    /** Native open dialog; null when cancelled. Rejects when the file cannot be read. */
    open(): Promise<OpenedFile | null>;
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
