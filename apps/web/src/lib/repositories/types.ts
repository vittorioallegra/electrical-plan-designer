// Persistence interfaces: the draft of the open project and access to project files.
import type { ProjectFile } from '@epd/domain/projectFile';
import type { ProjectAssets } from '@/lib/projectFile/epd';

/** A project file the user picked. */
export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

/** Project files, the same on every browser: a file input to open, a download to save. */
export interface FileAccess {
  /** Asks the user for a project file; null when cancelled. */
  open(): Promise<PickedFile | null>;
  /** Downloads a project file; the browser picks the folder and renames on a name clash. */
  download(bytes: Uint8Array, name: string): void;
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
