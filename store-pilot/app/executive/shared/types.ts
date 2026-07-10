import type {
  DecisionTaskStatus,
  ExecutiveDecisionCategory,
  ExecutiveDecisionSeverity,
  ExecutiveSourceEngine,
  PatternSeedType,
  QuickWinType,
} from "@prisma/client";

export type ExecutiveDecisionRecord = {
  id: string;
  title: string;
  category: ExecutiveDecisionCategory;
  severity: ExecutiveDecisionSeverity;
  priority: number;
  businessImpact: number;
  confidence: number;
  urgency: number;
  estimatedRevenueImpact: number;
  estimatedProfitImpact: number;
  estimatedEffort: number;
  estimatedTimeMinutes: number;
  recommendation: string;
  evidenceIds: string[];
  graphNodeIds: string[];
  relatedProducts: string[];
  relatedCollections: string[];
  relatedVendors: string[];
  businessMemoryIds: string[];
  historicalContext: Record<string, unknown>;
  sourceEngine: ExecutiveSourceEngine;
  rankScore: number;
  generatedAt: string;
  decisionKey: string;
};

export type DecisionTaskRecord = {
  id: string;
  decisionId: string;
  title: string;
  description: string;
  reason: string;
  status: DecisionTaskStatus;
  evidenceIds: string[];
  graphNodeIds: string[];
  businessMemoryIds: string[];
  businessImpact: number;
  estimatedEffort: number;
  estimatedTimeMinutes: number;
  confidence: number;
};

export type OperationalReadinessRecord = {
  score: number;
  inventoryScore: number;
  pricingScore: number;
  seoScore: number;
  collectionsScore: number;
  automationScore: number;
  operationalRiskScore: number;
  executionCapacityScore: number;
  knowledgeConfidenceScore: number;
  historicalStabilityScore: number;
  predictionReadinessScore: number;
};

export type BusinessContextPayload = {
  businessSummary: Record<string, unknown>;
  storeHealth: Record<string, unknown>;
  businessDna: Record<string, unknown>;
  topRisks: Array<Record<string, unknown>>;
  topOpportunities: Array<Record<string, unknown>>;
  priorityDecisions: ExecutiveDecisionRecord[];
  revenueOpportunities: Array<Record<string, unknown>>;
  historicalContext: Record<string, unknown>;
  merchantProfile: Record<string, unknown>;
  operationalReadiness: OperationalReadinessRecord;
  recentChanges: Array<Record<string, unknown>>;
  predictionReadiness: Record<string, unknown>;
  experimentReadiness: Record<string, unknown>;
  quickWinSummary: Record<string, unknown> | null;
  rootCauseAnalysis?: Array<Record<string, unknown>>;
  predictionAnalysis?: Array<Record<string, unknown>>;
  preventionRecommendations?: Array<Record<string, unknown>>;
  businessStability?: Record<string, unknown>;
  experimentSummary?: Record<string, unknown>;
  experimentRecommendations?: Array<Record<string, unknown>>;
  merchantIntelligence?: Record<string, unknown>;
  generatedAt: string;
};

export type ExecutiveBriefingPayload = {
  headline: string;
  greeting: string;
  sections: Array<{
    key: string;
    title: string;
    content: string;
    priority: number;
  }>;
  topPriority: string;
  todaysFocus: string[];
  businessOutlook: string;
};

export type DailyOperatingPlanPayload = {
  title: string;
  estimatedCompletionMinutes: number;
  estimatedRevenueOpportunity: number;
  estimatedProfitOpportunity: number;
  taskCount: number;
  tasks: Array<{
    decisionId: string;
    title: string;
    description: string;
    reason: string;
    evidenceIds: string[];
    businessImpact: number;
    estimatedEffort: number;
    estimatedTimeMinutes: number;
    confidence: number;
    actions: Array<"approve" | "ignore" | "learn_more">;
  }>;
};

export type DecisionCardPayload = {
  decisionId: string;
  title: string;
  category: ExecutiveDecisionCategory;
  severity: ExecutiveDecisionSeverity;
  estimatedLossPerDay: number | null;
  cause: string;
  confidencePercent: number;
  evidenceFactTypes: string[];
  businessImpactLabel: string;
  recommendedAction: string;
};

export type ExecutiveDecisionEngineInput = {
  storeId: string;
};

export type ExecutiveDecisionEngineResult = {
  success: boolean;
  storeId: string;
  decisionCount: number;
  taskCount: number;
  operationalReadinessScore: number;
  contextSnapshotId: string;
  executiveCooReady: boolean;
};

export type DecisionContextBundle = {
  storeId: string;
  quickWins: Array<{
    winType: QuickWinType;
    category: string;
    title: string;
    description: string;
    affectedCount: number;
    businessImpact: number;
    confidence: number;
    urgency: number;
    revenueOpportunity: number;
    rankScore: number;
    evidenceIds: string[];
    sourceFactTypes: string[];
  }>;
  quickWinSummary: {
    totalWins: number;
    estimatedRevenueOpportunity: number;
    headline: string;
  } | null;
  patternSeeds: Array<{
    id: string;
    patternType: PatternSeedType;
    semanticLabel: string;
    confidence: number;
    patternJson: Record<string, unknown>;
  }>;
  confidenceSeeds: Array<{
    domain: string;
    confidencePercent: number;
  }>;
  merchantBaselines: Array<{
    baselineType: string;
    baselineJson: Record<string, unknown>;
  }>;
  businessDna: Record<string, unknown> | null;
  historicalMemory: Record<string, unknown> | null;
  learningReadiness: {
    stage: string;
    overallConfidencePercent: number;
    executiveCooReady: boolean;
    predictionReady: boolean;
    experimentReady: boolean;
    merchantIntelligenceReady: boolean;
  } | null;
  learningPriorities: Array<{ domain: string; priorityOrder: number }>;
  graphStats: {
    totalNodes: number;
    totalEdges: number;
  };
};

export type ScoredExecutiveDecision = ExecutiveDecisionRecord & {
  decisionKey: string;
};

export type QuickWinToDecisionMapping = {
  winType: QuickWinType;
  category: ExecutiveDecisionCategory;
  recommendation: string;
  severityFromUrgency: (urgency: number) => ExecutiveDecisionSeverity;
};

export type PatternToDecisionMapping = {
  patternType: PatternSeedType;
  category: ExecutiveDecisionCategory;
  title: (label: string) => string;
  recommendation: string;
};
