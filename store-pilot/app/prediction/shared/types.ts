import type {
  ForecastWindow,
  PredictionType,
  PreventionActionType,
} from "@prisma/client";

export type ContributingSignal = {
  signalKey: string;
  domain: string;
  magnitude: number;
  direction: "up" | "down" | "stable";
};

export type PredictionRecord = {
  id: string;
  predictionKey: string;
  predictionType: PredictionType;
  title: string;
  description: string;
  forecastWindow: ForecastWindow;
  predictedOutcome: string;
  predictedValue: number | null;
  predictedUnit: string;
  confidence: number;
  contributingSignals: ContributingSignal[];
  historicalSupport: Record<string, unknown>;
  evidenceIds: string[];
  graphNodeIds: string[];
  timelineIds: string[];
  rootCauseIds: string[];
  expectedBusinessImpact: number;
  rankScore: number;
  generatedAt: string;
};

export type PreventionActionRecord = {
  id: string;
  predictionId: string;
  actionKey: string;
  actionType: PreventionActionType;
  title: string;
  description: string;
  recommendedAction: string;
  expectedImpactProtected: number;
  expectedPreventionPct: number;
  estimatedEffort: number;
  estimatedTimeMinutes: number;
  confidence: number;
  evidenceIds: string[];
};

export type PredictionConfidenceBreakdown = {
  confidenceScore: number;
  signalStrength: number;
  historicalSupport: number;
  timelineSupport: number;
  rootCauseSupport: number;
  forecastModelSupport: number;
};

export type BusinessStabilityRecord = {
  score: number;
  forecastVolatilityScore: number;
  inventoryRiskScore: number;
  revenueStabilityScore: number;
  supplierReliabilityScore: number;
  seasonalUncertaintyScore: number;
  pricingStabilityScore: number;
  trafficConsistencyScore: number;
};

export type PredictionContextBundle = {
  storeId: string;
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
  rootCauses: Array<{
    id: string;
    businessOutcome: string;
    primaryCause: string;
    confidence: number;
    evidenceIds: string[];
    timeline: unknown[];
  }>;
  quickWins: Array<{
    id: string;
    winType: string;
    title: string;
    affectedCount: number;
    revenueOpportunity: number;
    evidenceIds: string[];
  }>;
  graphStats: { totalNodes: number; totalEdges: number };
};

export type PredictionEngineResult = {
  success: boolean;
  storeId: string;
  predictionCount: number;
  preventionActionCount: number;
  businessStabilityScore: number;
  topPrediction: PredictionRecord | null;
};

export type PredictionUiItem = {
  predictionId: string;
  predictionType: PredictionType;
  title: string;
  predictedOutcome: string;
  confidencePercent: number;
  forecastWindow: ForecastWindow;
  expectedBusinessImpact: number;
  preventionAction: string | null;
  expectedImpactProtected: number;
};

export type ForecastModelDefinition = {
  modelKey: string;
  modelType: string;
  domain: string;
  horizonDays: number;
};

export type PredictionDefinition = {
  predictionType: PredictionType;
  predictionKey: string;
  title: string;
  requiredSignals: string[];
  forecastWindow: ForecastWindow;
  buildOutcome: (input: PredictionBuildInput) => {
    predictedOutcome: string;
    predictedValue: number | null;
    predictedUnit: string;
    description: string;
  };
};

export type PredictionBuildInput = {
  context: PredictionContextBundle;
  signals: ContributingSignal[];
  averageOrderValue: number;
};

export type ExplainablePredictionPayload = {
  predictionId: string;
  predictionType: PredictionType;
  confidence: number;
  forecastWindow: ForecastWindow;
  predictedOutcome: string;
  contributingSignals: ContributingSignal[];
  historicalSupport: Record<string, unknown>;
  evidenceIds: string[];
  graphNodeIds: string[];
  timelineIds: string[];
  preventionActions: PreventionActionRecord[];
  expectedBusinessImpact: number;
};
