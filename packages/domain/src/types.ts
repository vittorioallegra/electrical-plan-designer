// Domain types. Document types are inferred from the zod schema so they never drift.
import type { z } from 'zod';
import type {
  backgroundSchema,
  cableColorSchema,
  calibrationSchema,
  circuitConductorSchema,
  circuitSchema,
  conduitSegmentSchema,
  contentLineSchema,
  extraConductorRunSchema,
  extraConductorSchema,
  floorSchema,
  laborLineSchema,
  mountingSchema,
  nodeKindSchema,
  panelDeviceSchema,
  panelSchema,
  planNodeSchema,
  pointSchema,
  projectDocBaseSchema,
  projectSettingsSchema,
  quoteSettingsSchema,
  routingSchema,
  runElevationSchema,
  wallSchema,
  quoteLineSchema,
  quoteTotalsSchema,
  issuedQuoteSchema,
  projectQuoteSchema,
  priceOverridesSchema,
  boxPresetSchema,
  quoteStatusSchema,
} from './schema';

export type Point = z.infer<typeof pointSchema>;
export type RunElevation = z.infer<typeof runElevationSchema>;
export type CableColor = z.infer<typeof cableColorSchema>;
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
export type LaborLine = z.infer<typeof laborLineSchema>;
export type QuoteSettings = z.infer<typeof quoteSettingsSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;
export type Background = z.infer<typeof backgroundSchema>;
export type Wall = z.infer<typeof wallSchema>;
export type Floor = z.infer<typeof floorSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type Mounting = z.infer<typeof mountingSchema>;
export type ContentLine = z.infer<typeof contentLineSchema>;
export type PlanNode = z.infer<typeof planNodeSchema>;
export type ConduitSegment = z.infer<typeof conduitSegmentSchema>;
export type PanelDevice = z.infer<typeof panelDeviceSchema>;
export type Panel = z.infer<typeof panelSchema>;
export type Routing = z.infer<typeof routingSchema>;
export type CircuitConductor = z.infer<typeof circuitConductorSchema>;
export type Circuit = z.infer<typeof circuitSchema>;
export type ExtraConductor = z.infer<typeof extraConductorSchema>;
export type ExtraConductorRun = z.infer<typeof extraConductorRunSchema>;
export type ProjectDoc = z.infer<typeof projectDocBaseSchema>;

/** Project row metadata outside the document. */
export interface ProjectMeta {
  id: string;
  name: string;
  clientName: string;
  address: string;
  updatedAt: string;
  version: number;
}

export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type QuoteTotals = z.infer<typeof quoteTotalsSchema>;
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type IssuedQuote = z.infer<typeof issuedQuoteSchema>;
export type ProjectQuote = z.infer<typeof projectQuoteSchema>;
export type PriceOverrides = z.infer<typeof priceOverridesSchema>;
export type BoxPreset = z.infer<typeof boxPresetSchema>;
