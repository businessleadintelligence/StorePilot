import type {
  ExperimentDomain,
  ExperimentEventType,
  ExperimentRiskLevel,
  ExperimentSourceType,
  ExperimentStatus,
  ExperimentWinnerOutcome,
} from "@prisma/client";

export type ExperimentBaselineMetrics = {
  revenue: number;
  conversion: number;
  ctr: number;
  inventory: number;
  traffic: number;
  seoScore: number;
  refunds: number;
  aov: number;
  margin: number;
};

export type ExperimentSuccessMetrics = {
  primaryMetric: string;
  targetImprovementPct: number;
  secondaryMetrics: string[];
};

export type ExperimentOpportunityRecord = {
  opportunityKey: string;
  domain: ExperimentDomain;
  title: string;
  businessProblem: string;
  sourceType: ExperimentSourceType;
  sourceId: string;
  evidenceIds: string[];
  memoryIds: string[];
  predictionIds: string[];
  rootCauseIds: string[];
  estimatedImpact: number;
  confidence: number;
  templateKey: string;
};

export type ExperimentVariantRecord = {
  variantKey: string;
  variantLabel: string;
  currentValue: string;
  proposedValue: string;
  isControl: boolean;
};

export type ExperimentRecord = {
  experimentKey: string;
  experimentDomain: ExperimentDomain;
  templateKey: string;
  title: string;
  businessProblem: string;
  proposedChange: string;
  expectedRevenueImpact: number;
  expectedProfitImpact: number;
  confidence: number;
  estimatedDurationDays: number;
  merchantEffort: number;
  businessRisk: ExperimentRiskLevel;
  baselineMetrics: ExperimentBaselineMetrics;
  successMetrics: ExperimentSuccessMetrics;
  evidenceIds: string[];
  graphNodeIds: string[];
  memoryIds: string[];
  predictionIds: string[];
  rootCauseIds: string[];
  recommendationSource: ExperimentSourceType;
  shadowSimulationJson: Record<string, unknown>;
  status: ExperimentStatus;
  rankScore: number;
  variants: ExperimentVariantRecord[];
  reason: string;
};

export type ExperimentConfidenceBreakdown = {
  confidenceScore: number;
  observationCount: number;
  dataCoverage: number;
  businessStability: number;
  historicalSupport: number;
  merchantSimilarity: number;
  freshness: number;
};

export type ExperimentComparisonResult = {
  variantKey: string;
  metricKey: string;
  baselineValue: number;
  variantValue: number;
  difference: number;
  differencePct: number;
  confidence: number;
};

export type ExperimentWinnerRecord = {
  variantKey: string;
  outcome: ExperimentWinnerOutcome;
  confidence: number;
  revenueImpact: number;
  profitImpact: number;
};

export type ExperimentContextBundle = {
  storeId: string;
  currency: string;
  evidenceGroups: Map<string, { count: number; evidenceIds: string[]; avgConfidence: number }>;
  patternSeeds: Array<{
    id: string;
    patternType: string;
    semanticLabel: string;
    confidence: number;
    patternJson: Record<string, unknown>;
  }>;
  merchantBaselines: Array<{
    id: string;
    baselineType: string;
    baselineJson: Record<string, unknown>;
  }>;
  quickWins: Array<{
    id: string;
    winType: string;
    title: string;
    affectedCount: number;
    revenueOpportunity: number;
    evidenceIds: string[];
  }>;
  rootCauses: Array<{
    id: string;
    businessOutcome: string;
    primaryCause: string;
    confidence: number;
    evidenceIds: string[];
  }>;
  predictions: Array<{
    id: string;
    predictionKey: string;
    predictionType: string;
    title: string;
    confidence: number;
    expectedBusinessImpact: number;
    evidenceIds: string[];
  }>;
  preventionActions: Array<{
    id: string;
    actionType: string;
    recommendedAction: string;
    expectedImpactProtected: number;
  }>;
  businessStabilityScore: number;
  graphStats: { totalNodes: number; totalEdges: number };
};

export type ExperimentEngineResult = {
  success: boolean;
  storeId: string;
  opportunityCount: number;
  experimentCount: number;
  recommendationCount: number;
  topExperiment: ExperimentRecord | null;
};

export type ExperimentUiItem = {
  experimentId: string;
  title: string;
  proposedChange: string;
  reason: string;
  expectedMonthlyGain: number;
  confidencePercent: number;
  businessRisk: ExperimentRiskLevel;
  estimatedDurationDays: number;
  status: ExperimentStatus;
};

export type ExperimentLearningEvent = {
  eventType: ExperimentEventType;
  experimentKey: string;
  eventJson: Record<string, unknown>;
  memoryIds: string[];
  evidenceIds: string[];
};

export type ExperimentTemplateDefinition = {
  templateKey: string;
  domain: ExperimentDomain;
  title: string;
  requiredSourceTypes: ExperimentSourceType[];
  matchDomains: string[];
  buildExperiment: (input: ExperimentBuildInput) => Omit<
    ExperimentRecord,
    | "experimentKey"
    | "rankScore"
    | "status"
    | "variants"
    | "reason"
    | "shadowSimulationJson"
  > & { variants: ExperimentVariantRecord[]; reason: string };
};

export type ExperimentBuildInput = {
  opportunity: ExperimentOpportunityRecord;
  context: ExperimentContextBundle;
  baseline: ExperimentBaselineMetrics;
};

export type SuggestedExperimentPayload = {
  experimentId: string;
  experimentType: ExperimentDomain;
  title: string;
  businessProblem: string;
  proposedChange: string;
  expectedRevenueImpact: number;
  expectedProfitImpact: number;
  confidence: number;
  estimatedDuration: number;
  merchantEffort: number;
  businessRisk: ExperimentRiskLevel;
  baselineMetrics: ExperimentBaselineMetrics;
  successMetrics: ExperimentSuccessMetrics;
  evidenceIds: string[];
  graphNodeIds: string[];
  memoryIds: string[];
  predictionIds: string[];
  rootCauseIds: string[];
  recommendationSource: ExperimentSourceType;
  status: ExperimentStatus;
};
