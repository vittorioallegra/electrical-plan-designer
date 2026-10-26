// Loading and migrating stored documents.
import { CURRENT_SCHEMA_VERSION, projectDocSchema } from './schema';
import type { ProjectDoc } from './types';

export type DocLoadErrorCode = 'invalid_doc' | 'unsupported_version';

export class DocLoadError extends Error {
  override name = 'DocLoadError';
  constructor(
    readonly code: DocLoadErrorCode,
    readonly issues: { path: string; message: string }[],
  ) {
    super(`${code}: ${issues.map((i) => `${i.path || '(root)'} ${i.message}`).join('; ')}`);
  }
}

export interface LoadedDoc {
  doc: ProjectDoc;
  /** True when the stored doc was written by a newer app: show it, never save over it. */
  readOnly: boolean;
}

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** v1 → v2: floor backgrounds name their file by asset id instead of storage path. */
function backgroundAssetIds(doc: Record<string, unknown>): Record<string, unknown> {
  const floors = Array.isArray(doc.floors) ? (doc.floors as unknown[]) : [];
  return {
    ...doc,
    floors: floors.map((floor) => {
      const f = floor as Record<string, unknown> | null;
      const bg = f?.background as Record<string, unknown> | undefined;
      if (!bg || typeof bg !== 'object' || !('storagePath' in bg)) return floor;
      const { storagePath, ...rest } = bg;
      return { ...f, background: { ...rest, assetId: storagePath } };
    }),
  };
}

/** migrations[n] upgrades a doc from schemaVersion n to n + 1. */
const migrations: Record<number, Migration> = { 1: backgroundAssetIds };

export function migrateDoc(raw: Record<string, unknown>): Record<string, unknown> {
  let doc = raw;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : NaN;
  if (!Number.isInteger(version) || version < 1) {
    throw new DocLoadError('unsupported_version', [
      { path: 'schemaVersion', message: `unsupported schemaVersion ${String(doc.schemaVersion)}` },
    ]);
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) {
      throw new DocLoadError('unsupported_version', [
        { path: 'schemaVersion', message: `no migration from ${version}` },
      ]);
    }
    doc = { ...step(doc), schemaVersion: version + 1 };
    version += 1;
  }
  return doc;
}

/** Validates (and migrates) a stored doc. Throws DocLoadError; never returns a broken doc. */
export function loadDoc(raw: unknown): LoadedDoc {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DocLoadError('invalid_doc', [{ path: '', message: 'document is not an object' }]);
  }
  const migrated = migrateDoc(raw as Record<string, unknown>);
  const result = projectDocSchema.safeParse(migrated);
  if (!result.success) {
    throw new DocLoadError(
      'invalid_doc',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return { doc: result.data, readOnly: result.data.schemaVersion > CURRENT_SCHEMA_VERSION };
}
