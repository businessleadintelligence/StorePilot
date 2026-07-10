import type {
  LearningDomain,
  LearningPriorityDomain,
  LearningStage,
  LearningVelocityTier,
  StoreSizeTier,
} from "@prisma/client";

export type StoreCatalogSnapshot = {
  productsCount: number;
  variantsCount: number;
  collectionsCount: number;
  ordersCount: number;
  inventoryItemsCount: number;
  locationsCount: number;
  vendorsCount: number;
  uniqueTagsCount: number;
  averageVariantsPerProduct: number;
  oldestOrderAt: Date | null;
  newestOrderAt: Date | null;
  storeCreatedAt: Date | null;
  estimatedHistoryMonths: number;
  storeAgeDays: number;
};

export type StoreComplexityScores = {
  catalogComplexityScore: number;
  historicalDepthScore: number;
  operationalComplexityScore: number;
};

export type LearningDurationEstimate = {
  bootstrapDurationMinutes: number;
  historicalImportMinutes: number;
  graphBuildMinutes: number;
  quickWinMinutes: number;
  totalEstimatedMinutes: number;
  workerEstimateMinutes: number;
  futureAiCostEstimateUsd: number;
};

export type DomainConfidenceMap = {
  inventory: number;
  products: number;
  pricing: number;
  seo: number;
  collections: number;
  operations: number;
  seasonality: number;
};

export type LearningVelocityAssignment = {
  domain: LearningDomain;
  velocity: LearningVelocityTier;
  statusLabel: string;
};

export type LearningPriorityAssignment = {
  domain: LearningPriorityDomain;
  priorityOrder: number;
};

export type BootstrapIntelligenceResult = {
  storeId: string;
  storeSize: StoreSizeTier;
  snapshot: StoreCatalogSnapshot;
  scores: StoreComplexityScores;
  duration: LearningDurationEstimate;
  confidences: DomainConfidenceMap;
  overallConfidencePercent: number;
  stage: LearningStage;
  velocities: LearningVelocityAssignment[];
  priorities: LearningPriorityAssignment[];
  merchantHeadline: string;
  merchantMessage: string;
  stageExplanation: string;
  historyMonthsDisplay: number;
};

export type LearningBootstrapStatus = {
  storeId: string;
  bootstrapStatus: string;
  profiledAt: string | null;
  stage: LearningStage;
  overallConfidencePercent: number;
  totalEstimatedMinutes: number;
  estimatedCompletionAt: string | null;
  merchantHeadline: string;
};

export type LearningReadinessUiData = {
  stage: LearningStage;
  stageLabel: string;
  overallConfidencePercent: number;
  merchantMessage: string;
  stageExplanation: string;
  estimatedCompletionMinutes: number;
  estimatedCompletionAt: string | null;
  historyMonthsDisplay: number;
  merchantHeadline: string;
  domains: Array<{
    domain: LearningDomain;
    label: string;
    confidencePercent: number;
    velocity: LearningVelocityTier;
    statusLabel: string;
  }>;
  importSteps: Array<{
    key: string;
    label: string;
    status: "pending" | "running" | "complete";
  }>;
  executiveCooReady: boolean;
  predictionReady: boolean;
  experimentReady: boolean;
  merchantIntelligenceReady: boolean;
};

export const LEARNING_STAGE_LABELS: Record<LearningStage, string> = {
  initializing: "Initializing",
  historical_import: "Historical Import",
  learning: "Learning",
  operational: "Operational",
  predictive: "Predictive",
  adaptive: "Adaptive",
};

export const LEARNING_DOMAIN_LABELS: Record<LearningDomain, string> = {
  inventory: "Inventory Intelligence",
  products: "Products Intelligence",
  pricing: "Pricing Intelligence",
  seo: "SEO Intelligence",
  collections: "Collections Intelligence",
  operations: "Operations Intelligence",
  seasonality: "Seasonality Intelligence",
  vendor_reliability: "Vendor Reliability",
  refund_behaviour: "Refund Behaviour",
  elasticity: "Price Elasticity",
  executive_coo: "Executive COO",
  prediction: "Prediction",
};
