// Catalog types, inferred from the zod schema so they never drift.
import type { z } from 'zod';
import type {
  catalogAttributesSchema,
  catalogCategorySchema,
  catalogItemSchema,
  deviceTypeSchema,
  panelDeviceTypeSchema,
  projectCatalogSchema,
} from './schema';

export type CatalogCategory = z.infer<typeof catalogCategorySchema>;
export type DeviceType = z.infer<typeof deviceTypeSchema>;
export type PanelDeviceType = z.infer<typeof panelDeviceTypeSchema>;
export type CatalogAttributes = z.infer<typeof catalogAttributesSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type ProjectCatalog = z.infer<typeof projectCatalogSchema>;

export const BUILTIN_PREFIX = 'builtin:';

export function isBuiltin(item: Pick<CatalogItem, 'id'>): boolean {
  return item.id.startsWith(BUILTIN_PREFIX);
}
