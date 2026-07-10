import type {
  BusinessOutcomeType,
  CausalRelationType,
  RootCauseSeverity,
} from "@prisma/client";

export type CausalChainStep = {
  stepId: string;
  label: string;
  domain: string;
  evidenceIds: string[];
  timestamp?: string;
};

export type CausalTimelineEvent = {
  eventId: string;
  dayOffset: number;
  label: string;
  signal: string;
  evidenceIds: string[];
  role: "event" | "signal" | "cause" | "consequence";
};

export type SignalSnapshot = {
  signalKey: string;
  domain: string;
  direction: "up" | "down" | "stable";
  magnitude: number;
  evidenceIds: string[];
  factTypes: string[];
  source: "evidence" | "pattern" | "quick_win" | "baseline";
};

export type SignalCorrelationRecord = {
  correlationKey: string;
  signalA: string;
  signalB: string;
  relationType: CausalRelationType;
  strength: number;
  evidenceIds: string[];
};

export type ConfidenceBreakdown = {
  confidenceScore: number;
  evidenceCount: number;
  graphSupport: number;
  historicalSupport: number;
  freshness: number;
  crossSourceAgreement: number;
};

export type ImpactEstimate = {
  revenueImpact: number;
  profitImpact: number;
  operationalImpact: number;
  customerImpact: number;
  urgency: number;
};

export type RootCauseRecord = {
  id: string;
  causeKey: string;
  businessOutcome: BusinessOutcomeType;
  primaryCause: string;
  secondaryCauses: string[];
  contributingFactors: string[];
  confidence: number;
  evidenceIds: string[];
  graphNodeIds: string[];
  businessMemoryIds: string[];
  quickWinIds: string[];
  merchantBaselineIds: string[];
  causalChain: CausalChainStep[];
  timeline: CausalTimelineEvent[];
  historicalSupport: Record<string, unknown>;
  impactEstimate: ImpactEstimate;
  severity: RootCauseSeverity;
  urgency: number;
  rankScore: number;
  generatedAt: string;
};

export type RootCauseExplanationPayload = {
  primaryCause: string;
  secondaryCauses: string[];
  confidence: number;
  timeline: CausalTimelineEvent[];
  evidence: Array<{ id: string; factType?: string }>;
  causalChain: CausalChainStep[];
  businessOutcome: BusinessOutcomeType;
};

export type BusinessTimelinePayload = {
  storeId: string;
  events: CausalTimelineEvent[];
  causes: RootCauseRecord[];
  generatedAt: string;
};

export type RootCauseEngineInput = {
  storeId: string;
  contextSnapshotId?: string;
};

export type RootCauseEngineResult = {
  success: boolean;
  storeId: string;
  rootCauseCount: number;
  correlationCount: number;
  topCause: RootCauseRecord | null;
};

export type RootCauseContextBundle = {
  storeId: string;
  evidenceGroups: Map<string, { count: number; evidenceIds: string[]; avgConfidence: number }>;
  patternSeeds: Array<{
    id: string;
    patternType: string;
    semanticLabel: string;
    confidence: number;
    patternJson: Record<string, unknown>;
  }>;
  quickWins: Array<{
    id: string;
    winType: string;
    title: string;
    evidenceIds: string[];
    sourceFactTypes: string[];
    revenueOpportunity: number;
    urgency: number;
    confidence: number;
  }>;
  merchantBaselines: Array<{
    id: string;
    baselineType: string;
    baselineJson: Record<string, unknown>;
  }>;
  historicalMemory: Record<string, unknown> | null;
  businessDna: Record<string, unknown> | null;
  graphStats: { totalNodes: number; totalEdges: number };
};

export type OutcomeDetectionRule = {
  outcome: BusinessOutcomeType;
  requiredSignals: string[];
  optionalSignals?: string[];
  primaryCauseTemplate: string;
  chainTemplate: CausalChainStep[];
};

export type CausalRule = {
  id: string;
  causeDomain: string;
  outcomeDomain: string;
  allowed: boolean;
  reason: string;
};

export type RootCauseUiItem = {
  id: string;
  businessOutcome: BusinessOutcomeType;
  primaryCause: string;
  confidencePercent: number;
  severity: RootCauseSeverity;
  revenueImpact: number;
  evidenceCount: number;
  timelineLength: number;
};
