// The project file: everything a project needs, saved as one `.epd` zip
// (manifest.json + project.json + assets/). This module owns the JSON parts; the zip and the
// asset bytes live in the app.
import { z } from 'zod';
import { projectCatalogSchema } from './catalog/schema';
import { defaultProjectSettings, defaultQuoteSettings, newProjectDoc } from './defaults';
import { newId, type IdGenerator } from './ids';
import { migrateDoc } from './load';
import { ProjectFileError } from './projectFile/errors';
import { migrateProjectFile, PROJECT_FILE_SCHEMA_VERSION } from './projectFile/migrations';
import {
  boxPresetSchema,
  CURRENT_SCHEMA_VERSION,
  priceOverridesSchema,
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

/** The business shown on quotes; per project, seeded from defaults or a template. */
export const companySchema = z.object({
  businessName: z.string(),
  vatNumber: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  /** Id of the logo in the file's `assets/`. */
  logoAssetId: z.string().min(1).optional(),
});

export const projectFileSchema = z
  .object({
    meta: projectFileMetaSchema,
    company: companySchema,
    settings: projectSettingsSchema,
    quote: projectQuoteSchema,
    catalogs: z.array(projectCatalogSchema),
    priceOverrides: priceOverridesSchema,
    boxPresets: z.array(boxPresetSchema),
    doc: projectDocSchema,
  })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    file.catalogs.forEach((c, i) => {
      if (ids.has(c.id))
        ctx.addIssue({ code: 'custom', path: ['catalogs', i, 'id'], message: 'duplicate id' });
      ids.add(c.id);
    });
  });

export type ProjectFileManifest = z.infer<typeof projectFileManifestSchema>;
export type ProjectFileMeta = z.infer<typeof projectFileMetaSchema>;
export type Company = z.infer<typeof companySchema>;
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

export function defaultCompany(): Company {
  return { businessName: '', vatNumber: '', address: '', phone: '', email: '' };
}

export interface NewProjectInput {
  name: string;
  clientName?: string;
  address?: string;
  /** Translated name of the first floor. */
  firstFloorName: string;
}

function newMeta(input: NewProjectInput, now: Date): ProjectFileMeta {
  return {
    name: input.name,
    clientName: input.clientName ?? '',
    address: input.address ?? '',
    createdAt: now.toISOString(),
  };
}

/** A new project from the app defaults: one empty floor, no catalogs, no quotes. */
export function newProjectFile(
  input: NewProjectInput,
  now: Date,
  genId: IdGenerator = newId,
): ProjectFile {
  const settings = defaultProjectSettings();
  return {
    meta: newMeta(input, now),
    company: defaultCompany(),
    settings,
    quote: { settings: defaultQuoteSettings(), issued: [] },
    catalogs: [],
    priceOverrides: {},
    boxPresets: [],
    doc: newProjectDoc(input.firstFloorName, settings, genId),
  };
}

/**
 * A new project that copies a template's settings, company data (the logo asset must be
 * copied along), catalogs, price overrides, box presets and quote rates. The drawing, the
 * labor lines and the issued quotes are not copied.
 */
export function projectFileFromTemplate(
  template: ProjectFile,
  input: NewProjectInput,
  now: Date,
  genId: IdGenerator = newId,
): ProjectFile {
  const t = structuredClone(template);
  return {
    meta: newMeta(input, now),
    company: t.company,
    settings: t.settings,
    quote: { settings: { ...t.quote.settings, laborLines: [] }, issued: [] },
    catalogs: t.catalogs,
    priceOverrides: t.priceOverrides,
    boxPresets: t.boxPresets,
    doc: newProjectDoc(input.firstFloorName, t.settings, genId),
  };
}
