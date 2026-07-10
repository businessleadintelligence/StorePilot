import type {
  EvidenceEntityType,
  KnowledgeIntelligenceDomain,
  KnowledgeSyncMode,
} from "@prisma/client";

export type KnowledgeFactType =
  | "InventoryLow"
  | "InventoryCritical"
  | "HighInventory"
  | "NeverSold"
  | "RecentlyPublished"
  | "MissingSEO"
  | "MissingMetaDescription"
  | "PriceChanged"
  | "MarginRiskCandidate"
  | "LowVariantCoverage"
  | "OrphanCollection"
  | "BundleCandidateSeed"
  | "InactiveProduct"
  | "RefundRiskSeed"
  | "SeasonalCandidate"
  | "Discontinued"
  | "OutOfStock"
  | "LowMediaCoverage"
  | "NoDescription"
  | "MissingAltText"
  | "DraftTooLong"
  | "SingleProductCollection"
  | "PriceAboveCategoryAverage";

export const KNOWLEDGE_FACT_TYPES: KnowledgeFactType[] = [
  "InventoryLow",
  "InventoryCritical",
  "HighInventory",
  "NeverSold",
  "RecentlyPublished",
  "MissingSEO",
  "MissingMetaDescription",
  "PriceChanged",
  "MarginRiskCandidate",
  "LowVariantCoverage",
  "OrphanCollection",
  "BundleCandidateSeed",
  "InactiveProduct",
  "RefundRiskSeed",
  "SeasonalCandidate",
  "Discontinued",
  "OutOfStock",
  "LowMediaCoverage",
  "NoDescription",
  "MissingAltText",
  "DraftTooLong",
  "SingleProductCollection",
  "PriceAboveCategoryAverage",
];

export type EvidenceDraft = {
  entity: EvidenceEntityType;
  entityId: string;
  factType: KnowledgeFactType;
  value?: Record<string, unknown> | number | string | boolean | null;
  observedAt: Date;
};

export type KnowledgePipelineInput = {
  storeId: string;
  shop: string;
  syncMode: KnowledgeSyncMode;
  batchSize?: number;
  resumeFromCheckpoint?: boolean;
  forceRefresh?: boolean;
};

export type KnowledgePipelineResult = {
  success: boolean;
  hasMoreWork: boolean;
  productsProcessed: number;
  ordersProcessed: number;
  evidenceCreated: number;
  evidenceUpdated: number;
  evidenceExpired: number;
  eventsEmitted: number;
  checkpointSaved: boolean;
  readinessUpdated: boolean;
};

export type KnowledgeReadinessSnapshot = {
  storeId: string;
  productIntelligencePercent: number;
  inventoryIntelligencePercent: number;
  pricingIntelligencePercent: number;
  operationsIntelligencePercent: number;
  executiveCooPercent: number;
  overallPercent: number;
  lastComputedAt: Date;
};

export type IntelligenceDomainReadiness = {
  domain: KnowledgeIntelligenceDomain;
  label: string;
  percent: number;
};

export type KnowledgeEventType =
  | "ProductImported"
  | "InventoryUpdated"
  | "OrderImported"
  | "ProductArchived"
  | "ProductDeleted"
  | "EvidenceCreated"
  | "EvidenceUpdated"
  | "EvidenceExpired";

export type KnowledgeEvent = {
  type: KnowledgeEventType;
  storeId: string;
  entity?: EvidenceEntityType;
  entityId?: string;
  factType?: KnowledgeFactType;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
};

export type CollectorCheckpoint = {
  productCursor: string | null;
  orderCursor: string | null;
  inventoryCursor: string | null;
  collectionCursor: string | null;
  productsProcessed: number;
  ordersProcessed: number;
};

export type { ShopifyRawOrder, ShopifyRawProduct } from "../mapping/shopify-mapping";

export type QualityScores = {
  confidence: number;
  freshnessMinutes: number;
  completeness: number;
  reliability: number;
  observationCount: number;
  sourcePriority: number;
};
