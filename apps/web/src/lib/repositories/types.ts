// Persistence interfaces: the draft of the open project and access to project files.
import type { ProjectFile } from '@epd/domain/projectFile';
import type { ProjectAssets } from '@/lib/projectFile/epd';

/** A project file on disk, as the file access implementation identifies it. */
export interface FileRef {
  name: string;
  /**
   * Opaque handle for writing the file back (a FileSystemFileHandle on Chrome and Edge);
   * null when the file can only be downloaded again. Structured-cloneable (kept in drafts).
   */
  handle: unknown;
}

export interface PickedFile {
  file: FileRef;
  bytes: Uint8Array;
}

export interface FileAccess {
  /** True when Save overwrites the opened file; otherwise Save downloads it. */
  readonly canOverwrite: boolean;
  /** Asks the user for a project file; null when cancelled. */
  open(): Promise<PickedFile | null>;
  /** Reads a recent file again; null when it is gone or access was denied. */
  reopen(file: FileRef): Promise<PickedFile | null>;
  /** Overwrites the file (or downloads it again). Throws when writing fails. */
  save(file: FileRef, bytes: Uint8Array): Promise<FileRef>;
  /** Asks where to save; null when cancelled. Throws when writing fails. */
  saveAs(bytes: Uint8Array, suggestedName: string): Promise<FileRef | null>;
  /** Files opened or saved lately, newest first (empty without the File System Access API). */
  recent(): Promise<FileRef[]>;
}

/** The open project as autosave keeps it on this device. */
export interface Draft {
  project: ProjectFile;
  /** Only the assets the project references. */
  assets: ProjectAssets;
  /** The file the project was opened from or last saved to; null for a new project. */
  file: FileRef | null;
  /** True when that file already has every change in the draft. */
  savedToFile: boolean;
  savedAt: string;
}

/** One draft per app: the project open in the tab. */
export interface DraftRepository {
  get(): Promise<Draft | null>;
  save(draft: Draft): Promise<void>;
  clear(): Promise<void>;
}
