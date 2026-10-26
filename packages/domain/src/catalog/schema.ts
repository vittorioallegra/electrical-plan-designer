// Zod schema of catalog items and project catalogs, as stored in a project file.
import { z } from 'zod';
import { cableColorSchema } from '../schema';

const finite = z.number().finite();
const positive = finite.positive();

export const catalogCategorySchema = z.enum([
  'device',
  'blanking_cover',
  'plate',
  'box',
  'junction_box',
  'conduit',
  'cable',
  'panel_device',
  'enclosure',
]);

export const deviceTypeSchema = z.enum([
  'socket',
  'schuko',
  'universal_socket',
  'switch',
  'two_way',
  'intermediate',
  'push_button',
  'dimmer',
  'usb',
  'tv',
  'data',
  'other',
]);

export const panelDeviceTypeSchema = z.enum(['mcb', 'rcd', 'rcbo', 'isolator', 'spd', 'other']);

export const catalogAttributesSchema = z.object({
  deviceType: deviceTypeSchema.optional(),
  /** Conduit outer/inner diameter, mm. */
  outerDiameter: positive.optional(),
  innerDiameter: positive.optional(),
  /** Cable cross-section, mm²; cable outer Ø uses `outerDiameter`. */
  crossSection: positive.optional(),
  color: cableColorSchema.optional(),
  panelDeviceType: panelDeviceTypeSchema.optional(),
  poles: z.string().optional(),
  ratingA: positive.optional(),
  curve: z.enum(['B', 'C', 'D']).optional(),
  sensitivityMa: positive.optional(),
  rcdType: z.enum(['A', 'AC', 'F', 'B']).optional(),
  /** Enclosure layout. */
  rails: z.number().int().positive().optional(),
  modulesPerRail: z.number().int().positive().optional(),
});

export const catalogItemSchema = z.object({
  /** `builtin:<slug>` for built-ins, `<catalogId>:<code or generated>` for imported items. */
  id: z.string().min(1),
  category: catalogCategorySchema,
  /** Built-ins: an i18n key (`catalog.builtin.<slug>`). Other items: the typed name. */
  name: z.string(),
  code: z.string().min(1).optional(),
  /** Integer cents. */
  unitPrice: z.number().int().nonnegative().optional(),
  unit: z.enum(['pcs', 'm']),
  /** DIN modules (panel devices) or box/plate/device modules. */
  modules: z.number().int().positive().optional(),
  attributes: catalogAttributesSchema,
  /** User items are archived instead of deleted. */
  archived: z.boolean().optional(),
  /** Set when the item was edited by hand after import; a catalog replace asks before overwriting it. */
  editedAt: z.string().optional(),
  /** In use but absent from the catalog that replaced its own: keeps its old data. */
  missing: z.boolean().optional(),
});

/** A catalog imported into a project (one manufacturer or price list). */
export const projectCatalogSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    importedAt: z.string(),
    /** Original file name. */
    source: z.string().optional(),
    items: z.array(catalogItemSchema),
  })
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>();
    catalog.items.forEach((item, i) => {
      if (!item.id.startsWith(`${catalog.id}:`))
        ctx.addIssue({ code: 'custom', path: ['items', i, 'id'], message: 'id outside catalog' });
      if (seen.has(item.id))
        ctx.addIssue({ code: 'custom', path: ['items', i, 'id'], message: 'duplicate id' });
      seen.add(item.id);
    });
  });
