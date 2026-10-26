// Writes the open project to its file: in place when it has one, through Save As otherwise.
import { APP_VERSION } from '@/config/version';
import { fileSafe } from '@/lib/download';
import { writeEpd } from '@/lib/projectFile/epd';
import type { FileAccess, FileBinding } from '@/lib/repositories/types';
import type { EditorStore } from './editorStore';

/** `auto` saves in place (or Save As when there is no file); `overwrite` ignores a file that
 * changed on disk; `saveAs` always asks for a new path. */
export type SaveMode = 'auto' | 'overwrite' | 'saveAs';

export type SaveOutcome =
  | { kind: 'saved'; file: FileBinding }
  | { kind: 'cancelled' }
  /** The file on disk is not the one the project was opened from or last saved to. */
  | { kind: 'conflict' }
  /** The OS refused the write; `code` is its error code. */
  | { kind: 'failed'; code: string };

/**
 * Builds the `.epd` and writes it. The project is marked saved only up to the revision that was
 * written; later edits stay unsaved. Throws when the file cannot be built or main is unreachable.
 */
export async function saveProject(
  store: EditorStore,
  fileAccess: FileAccess,
  mode: SaveMode,
): Promise<SaveOutcome> {
  const s = store.getState();
  const bytes = writeEpd(s.data, s.assets, { appVersion: APP_VERSION, now: new Date() });
  const bound = mode === 'saveAs' ? null : s.file;
  const result = bound
    ? await fileAccess.save(bound.path, bytes, mode === 'overwrite' ? null : bound.stat)
    : await fileAccess.saveAs(`${fileSafe(s.data.meta.name)}.epd`, bytes);
  switch (result.status) {
    case 'saved': {
      const file = { path: result.path, name: result.name, stat: result.stat };
      store.getState().markSaved(s.revision, file);
      return { kind: 'saved', file };
    }
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'changed_on_disk':
      return { kind: 'conflict' };
    case 'failed':
      return { kind: 'failed', code: result.code };
  }
}
