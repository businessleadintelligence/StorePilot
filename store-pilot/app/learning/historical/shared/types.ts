import type { MerchantBaselineType, PatternSeedType } from "@prisma/client";

export type HistoricalIntelligenceInput = {
  storeId: string;
  graphVersion?: number;
  snapshotVersion?: number;
};

export type HistoricalIntelligenceResult = {
  success: boolean;
  storeId: string;
  memoryVersion: number;
  snapshotVersion: number;
  dnaVersion: number;
  baselineCount: number;
  patternSeedCount: number;
  confidenceSeedCount: number;
  overallConfidencePercent: number;
  learningStage: "learning";
};

export type MerchantBaselineRecord = {
  baselineType: MerchantBaselineType;
  baselineJson: Record<string, unknown>;
  confidence: number;
};

export type PatternSeedRecord = {
  patternType: PatternSeedType;
  semanticLabel: string;
  patternJson: Record<string, unknown>;
  confidence: number;
  observationCount: number;
  evidenceIds: string[];
};

export type ConfidenceSeedRecord = {
  domain: string;
  confidencePercent: number;
  baselinePercent: number;
  evidenceCoverage: number;
  graphCoverage: number;
};

export type BusinessMemoryBundle = {
  storeId: string;
  baselines: MerchantBaselineRecord[];
  patterns: PatternSeedRecord[];
  confidences: ConfidenceSeedRecord[];
  businessDna: Record<string, unknown>;
  summary: {
    productCount: number;
    orderCount: number;
    evidenceCount: number;
    graphNodeCount: number;
    graphEdgeCount: number;
  };
};

export type OrderDayBucket = {
  dayOfWeek: number;
  orderCount: number;
  revenue: number;
};

export type HistoricalAggregationSnapshot = {
  productCount: number;
  activeProductCount: number;
  orderCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageProductPrice: number;
  totalInventoryUnits: number;
  lowStockEvidenceCount: number;
  outOfStockEvidenceCount: number;
  refundRatio: number;
  recent30DayRevenue: number;
  prior30DayRevenue: number;
  ordersByDayOfWeek: OrderDayBucket[];
  evidenceByFactType: Record<string, number>;
  topProductTitles: Array<{ title: string; count: number }>;
};

export const CONFIDENCE_DOMAIN_MAP: Record<string, string[]> = {
  inventory: ["InventoryLow", "InventoryCritical", "HighInventory", "OutOfStock"],
  products: ["NeverSold", "RecentlyPublished", "InactiveProduct", "Discontinued"],
  pricing: ["PriceChanged", "MarginRiskCandidate", "PriceAboveCategoryAverage"],
  seo: ["MissingSEO", "MissingMetaDescription", "MissingAltText", "NoDescription"],
  collections: ["SingleProductCollection", "OrphanCollection"],
  operations: ["RefundRiskSeed", "OrderImported"],
  seasonality: ["SeasonalCandidate"],
};
