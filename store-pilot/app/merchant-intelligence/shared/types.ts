import type {
  DecisionJournalType,
  LearningUpdateType,
  MerchantActionType,
} from "@prisma/client";

export type DecisionJournalRecord = {
  journalKey: string;
  decisionType: DecisionJournalType;
  sourceId: string;
  title: string;
  recommendation: string;
  evidenceIds: string[];
  graphNodeIds: string[];
  memoryIds: string[];
  merchantAction: MerchantActionType;
  businessContext: Record<string, unknown>;
  outcome: string;
  revenueImpact: number;
  profitImpact: number;
  confidenceBefore: number;
  confidenceAfter: number;
  relatedRootCauseId: string;
  relatedPredictionId: string;
  relatedExperimentId: string;
};

export type LearningAttributionRecord = {
  attributionKey: string;
  businessOutcome: string;
  journalKey: string;
  evidenceIds: string[];
  graphNodeIds: string[];
  merchantAction: MerchantActionType;
  learningUpdateType: LearningUpdateType;
  memoryVersionNumber: number;
  dnaVersionNumber: number;
  attributionJson: Record<string, unknown>;
};

export type MerchantBehaviorRecord = {
  acceptsPricingChanges: number;
  rejectsInventoryChanges: number;
  ignoresSeo: number;
  prefersAutomation: number;
  acceptsHighConfidenceOnly: number;
  approvesWeekendExperiments: number;
  actsQuickly: number;
  delaysDecisions: number;
  prefersLowRisk: number;
  prefersLongTermGrowth: number;
  prefersOperationalEfficiency: number;
};

export type PersonalizationRecord = {
  priorityDomains: string[];
  deprioritizedDomains: string[];
  decisionStyle: string;
  riskTolerance: string;
  automationReadiness: number;
};

export type BusinessDnaV3Record = {
  versionNumber: number;
  businessCharacteristics: Record<string, unknown>;
  merchantDecisionStyle: string;
  optimizationMaturity: number;
  experimentMaturity: number;
  riskTolerance: string;
  automationReadiness: number;
  operationalDiscipline: number;
  learningVelocity: number;
  personalizationScore: number;
  decisionConsistency: number;
  confidenceScore: number;
};

export type AdaptiveScoreRecord = {
  score: number;
  merchantParticipationScore: number;
  journalCoverageScore: number;
  experimentCompletionScore: number;
  recommendationAcceptanceScore: number;
  predictionAccuracyScore: number;
  confidenceQualityScore: number;
  memoryCoverageScore: number;
  learningFreshnessScore: number;
  dnaMaturityScore: number;
  merchantFeedbackScore: number;
  cooImprovementScore: number;
};

export type ConfidenceEvolutionRecord = {
  confidenceKey: string;
  domain: string;
  confidenceScore: number;
  observationCount: number;
  historicalSupport: number;
  merchantValidation: number;
  outcomeAccuracy: number;
  timeDecay: number;
  evidenceQuality: number;
  freshness: number;
  businessStability: number;
};

export type MerchantIntelligenceContext = {
  storeId: string;
  patternSeeds: Array<{
    id: string;
    patternType: string;
    semanticLabel: string;
    confidence: number;
    patternJson: Record<string, unknown>;
  }>;
  businessDna: Record<string, unknown> | null;
  businessDnaVersion: number;
  journalEntries: DecisionJournalRecord[];
  experimentEvents: Array<{
    id: string;
    experimentId: string;
    eventType: string;
    eventJson: Record<string, unknown>;
    evidenceIds: string[];
    memoryIds: string[];
  }>;
  executiveDecisions: Array<{
    id: string;
    title: string;
    category: string;
    confidence: number;
    evidenceIds: string[];
  }>;
  predictions: Array<{
    id: string;
    predictionKey: string;
    confidence: number;
    expectedBusinessImpact: number;
  }>;
  rootCauses: Array<{
    id: string;
    primaryCause: string;
    confidence: number;
    businessOutcome: string;
  }>;
  experiments: Array<{
    id: string;
    experimentKey: string;
    status: string;
    confidence: number;
    expectedRevenueImpact: number;
  }>;
  businessStabilityScore: number;
  lastCheckpointAt: string | null;
};

export type MerchantIntelligenceResult = {
  success: boolean;
  storeId: string;
  journalEntriesProcessed: number;
  adaptiveScore: number;
  memoryVersionNumber: number;
  dnaVersionNumber: number;
  attributionCount: number;
};

export type MerchantIntelligenceUiData = {
  adaptiveScore: number;
  decisionJournalCount: number;
  behaviorProfile: MerchantBehaviorRecord | null;
  personalization: PersonalizationRecord | null;
  recentTimeline: Array<{ title: string; eventCategory: string; occurredAt: string }>;
  dnaVersion: number;
  learningStage: string;
};

export type TimelineEventRecord = {
  eventKey: string;
  eventCategory: string;
  title: string;
  eventJson: Record<string, unknown>;
  occurredAt: string;
};
