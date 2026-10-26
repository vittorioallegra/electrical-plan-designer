// The app library: the data that belongs to the user's installation, not to a project: company
// data, catalogs (with "My items"), price overrides, box presets and the defaults new projects
// start from. The desktop app stores it as files (`library.json` for everything but the
// catalogs, one file per catalog); this module owns the schema, the defaults and the loading.
import { z } from 'zod';
import { projectCatalogSchema } from './catalog/schema';
import { defaultProjectSettings, defaultQuoteSettings } from './defaults';
import {
  boxPresetSchema,
  priceOverridesSchema,
  projectSettingsSchema,
  quoteSettingsSchema,
} from './schema';

/** Version 1 until the first release; after it every change bumps it and adds a migration. */
export const LIBRARY_SCHEMA_VERSION = 1;

/** The business shown on quotes and PDFs. The logo is a separate file, not part of the JSON. */
export const libraryCompanySchema = z.object({
  businessName: z.string(),
  vatNumber: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
});

/** Everything but the catalogs, which are stored one file each. */
export const libraryCoreSchema = z.object({
  schemaVersion: z.number().int().positive(),
  company: libraryCompanySchema,
  priceOverrides: priceOverridesSchema,
  boxPresets: z.array(boxPresetSchema),
  defaults: z.object({ settings: projectSettingsSchema, quote: quoteSettingsSchema }),
});

export const librarySchema = libraryCoreSchema
  .extend({ catalogs: z.array(projectCatalogSchema) })
  .superRefine((library, ctx) => {
    const ids = new Set<string>();
    library.catalogs.forEach((c, i) => {
      if (ids.has(c.id))
        ctx.addIssue({ code: 'custom', path: ['catalogs', i, 'id'], message: 'duplicate id' });
      ids.add(c.id);
    });
  });

export type LibraryCompany = z.infer<typeof libraryCompanySchema>;
export type LibraryCore = z.infer<typeof libraryCoreSchema>;
export type Library = z.infer<typeof librarySchema>;

/** The company logo: a PNG or JPEG file of the library. */
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
export type LogoMimeType = (typeof LOGO_MIME_TYPES)[number];
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function isLogoMimeType(value: unknown): value is LogoMimeType {
  return LOGO_MIME_TYPES.includes(value as LogoMimeType);
}

/** The logo's file extension in the library folder and in an `.epl`. */
export function logoExtension(mimeType: LogoMimeType): 'png' | 'jpg' {
  return mimeType === 'image/png' ? 'png' : 'jpg';
}

/** Whether the bytes start like the image type they are filed under. */
export function matchesLogoType(mimeType: LogoMimeType, bytes: Uint8Array): boolean {
  if (mimeType === 'image/png') return [0x89, 0x50, 0x4e, 0x47].every((b, i) => bytes[i] === b);
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

export function defaultLibraryCompany(): LibraryCompany {
  return { businessName: '', vatNumber: '', address: '', phone: '', email: '' };
}

export function defaultLibraryCore(): LibraryCore {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    company: defaultLibraryCompany(),
    priceOverrides: {},
    boxPresets: [],
    defaults: { settings: defaultProjectSettings(), quote: defaultQuoteSettings() },
  };
}

/** An empty library with the app's default settings. */
export function defaultLibrary(): Library {
  return { ...defaultLibraryCore(), catalogs: [] };
}

export function libraryCoreOf(library: Library): LibraryCore {
  const { catalogs: _catalogs, ...core } = library;
  return core;
}

export type LibraryErrorCode =
  /** Not an object, or its `schemaVersion` is missing. */
  | 'not_a_library'
  /** Written by a newer app version: refused. */
  | 'newer_version'
  /** The content does not match the schema. */
  | 'invalid';

export class LibraryError extends Error {
  override name = 'LibraryError';
  constructor(
    readonly code: LibraryErrorCode,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(
      issues.length === 0
        ? code
        : `${code}: ${issues.map((i) => `${i.path || '(root)'} ${i.message}`).join('; ')}`,
    );
  }
}

function parse<S extends z.ZodType>(schema: S, json: unknown, versioned: boolean): z.infer<S> {
  if (versioned) {
    const version = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
    if (typeof json !== 'object' || json === null || typeof version !== 'number')
      throw new LibraryError('not_a_library', [{ path: 'schemaVersion', message: 'missing' }]);
    if (version > LIBRARY_SCHEMA_VERSION)
      throw new LibraryError('newer_version', [
        { path: 'schemaVersion', message: `library schema version ${version}` },
      ]);
  }
  const result = schema.safeParse(json);
  if (!result.success)
    throw new LibraryError(
      'invalid',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  return result.data;
}

/** Validates a whole library (an `.epl`, or the parts put together). Throws LibraryError. */
export function loadLibrary(json: unknown): Library {
  return parse(librarySchema, json, true);
}

/** Validates `library.json`. Throws LibraryError. */
export function loadLibraryCore(json: unknown): LibraryCore {
  return parse(libraryCoreSchema, json, true);
}

/** Validates one catalog file. Throws LibraryError. */
export function loadLibraryCatalog(json: unknown): Library['catalogs'][number] {
  return parse(projectCatalogSchema, json, false);
}
