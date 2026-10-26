// `.epc`: the app's JSON catalog file, exported from a project catalog and imported into
// another project.
import { z } from 'zod';
import type { IncomingCatalog } from './replace';
import { catalogItemSchema } from './schema';
import type { ProjectCatalog } from './types';

export const EPC_FORMAT = 'epc';
export const EPC_SCHEMA_VERSION = 1;

const incomingItemSchema = catalogItemSchema.omit({
  id: true,
  archived: true,
  editedAt: true,
  missing: true,
});

export const epcFileSchema = z.object({
  format: z.literal(EPC_FORMAT),
  schemaVersion: z.literal(EPC_SCHEMA_VERSION),
  name: z.string(),
  items: z.array(incomingItemSchema),
});

export type EpcFile = z.infer<typeof epcFileSchema>;

export type CatalogFileErrorCode = 'not_a_catalog' | 'newer_version' | 'invalid' | 'empty';

export class CatalogFileError extends Error {
  override name = 'CatalogFileError';
  constructor(readonly code: CatalogFileErrorCode) {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reads a parsed `.epc` file. Throws CatalogFileError. */
export function parseEpc(json: unknown, source?: string): IncomingCatalog {
  if (!isRecord(json) || json.format !== EPC_FORMAT) throw new CatalogFileError('not_a_catalog');
  if (typeof json.schemaVersion === 'number' && json.schemaVersion > EPC_SCHEMA_VERSION) {
    throw new CatalogFileError('newer_version');
  }
  const parsed = epcFileSchema.safeParse(json);
  if (!parsed.success) throw new CatalogFileError('invalid');
  return {
    name: parsed.data.name,
    ...(source === undefined ? {} : { source }),
    items: parsed.data.items,
  };
}

/** A project catalog as an `.epc` file: items left over from a replace are not exported. */
export function toEpc(catalog: ProjectCatalog): EpcFile {
  return {
    format: EPC_FORMAT,
    schemaVersion: EPC_SCHEMA_VERSION,
    name: catalog.name,
    items: catalog.items
      .filter((item) => !item.missing)
      .map(({ id: _id, archived: _a, editedAt: _e, missing: _m, ...item }) =>
        structuredClone(item),
      ),
  };
}
