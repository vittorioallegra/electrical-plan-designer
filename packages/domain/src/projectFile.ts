// The project file: everything a project needs, saved as one `.epd` zip
// (manifest.json + project.json + assets/). This module owns the JSON parts; the zip and the
// asset bytes live in the app.
import { z } from 'zod';
import { catalogItemSchema } from './catalog/schema';
import { newProjectDoc } from './defaults';
import { newId, type IdGenerator } from './ids';
import { migrateDoc } from './load';
import type { LibraryCore } from './library';
import { ProjectFileError } from './projectFile/errors';
import { migrateProjectFile, PROJECT_FILE_SCHEMA_VERSION } from './projectFile/migrations';
import {
  cablePricesSchema,
  CURRENT_SCHEMA_VERSION,
  projectDocSchema,
  projectQuoteSchema,
  projectSettingsSchema,
} from './schema';

export { ProjectFileError, type ProjectFileErrorCode } from './projectFile/errors';
export { PROJECT_FILE_SCHEMA_VERSION } from './projectFile/migrations';

export const PROJECT_FILE_FORMAT = 'epd';

export const projectFileManifestSchema = z.object({
  format: z.literal(PROJECT_FILE_FORMAT),
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  savedAt: z.string(),
});

export const projectFileMetaSchema = z.object({
  name: z.string(),
  clientName: z.string(),
  address: z.string(),
  createdAt: z.string(),
});

export const projectFileSchema = z
  .object({
    meta: projectFileMetaSchema,
    settings: projectSettingsSchema,
    quote: projectQuoteSchema,
    /** Copies of the catalog items the drawing uses, with their prices; kept by `copyUsedItems`. */
    items: z.array(catalogItemSchema).default([]),
    /** Prices of the cable lines, keyed `cable:<section>:<color>`. */
    cablePrices: cablePricesSchema.default({}),
    doc: projectDocSchema,
  })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    file.items.forEach((item, i) => {
      if (ids.has(item.id))
        ctx.addIssue({ code: 'custom', path: ['items', i, 'id'], message: 'duplicate id' });
      ids.add(item.id);
    });
  });

export type ProjectFileManifest = z.infer<typeof projectFileManifestSchema>;
export type ProjectFileMeta = z.infer<typeof projectFileMetaSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;

/** The two JSON documents of an `.epd` file. */
export interface SerializedProjectFile {
  manifest: ProjectFileManifest;
  project: ProjectFile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issuesOf(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/**
 * Validates manifest.json and project.json, running file and document migrations first.
 * Throws ProjectFileError; never returns a broken project.
 */
export function loadProjectFile(manifest: unknown, project: unknown): ProjectFile {
  if (!isRecord(manifest) || manifest.format !== PROJECT_FILE_FORMAT) {
    throw new ProjectFileError('not_a_project', [{ path: 'format', message: 'not an epd file' }]);
  }
  const header = projectFileManifestSchema.safeParse(manifest);
  if (!header.success) throw new ProjectFileError('invalid', issuesOf(header.error));
  if (!isRecord(project)) {
    throw new ProjectFileError('invalid', [{ path: '', message: 'project is not an object' }]);
  }
  const migrated = migrateProjectFile(project, header.data.schemaVersion);
  const doc = migrated.doc;
  if (isRecord(doc) && typeof doc.schemaVersion === 'number') {
    if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new ProjectFileError('newer_version', [
        { path: 'doc.schemaVersion', message: `doc schema version ${doc.schemaVersion}` },
      ]);
    }
    try {
      migrated.doc = migrateDoc(doc);
    } catch {
      throw new ProjectFileError('unsupported_version', [
        { path: 'doc.schemaVersion', message: `doc schema version ${doc.schemaVersion}` },
      ]);
    }
  }
  const result = projectFileSchema.safeParse(migrated);
  if (!result.success) throw new ProjectFileError('invalid', issuesOf(result.error));
  return result.data;
}

/** The manifest and a detached copy of the project, ready to be written as JSON. */
export function serializeProjectFile(
  project: ProjectFile,
  appVersion: string,
  now: Date,
): SerializedProjectFile {
  return {
    manifest: {
      format: PROJECT_FILE_FORMAT,
      schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
      appVersion,
      savedAt: now.toISOString(),
    },
    project: structuredClone(project),
  };
}

/** Assets the project points at: floor backgrounds. */
export function referencedAssetIds(project: Pick<ProjectFile, 'doc'>): Set<string> {
  const ids = new Set<string>();
  for (const floor of project.doc.floors) {
    if (floor.background) ids.add(floor.background.assetId);
  }
  return ids;
}

export interface NewProjectInput {
  name: string;
  clientName?: string;
  address?: string;
  /** Translated name of the first floor. */
  firstFloorName: string;
}

/**
 * A new project: one empty floor, no items, no quotes; the settings and quote rates are a copy
 * of the library defaults (the project edits its own from then on).
 */
export function newProjectFile(
  input: NewProjectInput,
  defaults: LibraryCore['defaults'],
  now: Date,
  genId: IdGenerator = newId,
): ProjectFile {
  const { settings, quote } = structuredClone(defaults);
  return {
    meta: {
      name: input.name,
      clientName: input.clientName ?? '',
      address: input.address ?? '',
      createdAt: now.toISOString(),
    },
    settings,
    quote: { settings: quote, issued: [] },
    items: [],
    cablePrices: {},
    doc: newProjectDoc(input.firstFloorName, settings, genId),
  };
}
