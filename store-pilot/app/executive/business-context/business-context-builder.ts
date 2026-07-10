import { createHash } from "node:crypto";

import type {
  BusinessContextPayload,
  DecisionContextBundle,
  OperationalReadinessRecord,
  ScoredExecutiveDecision,
} from "../shared/types";

export function buildBusinessContext(input: {
  context: DecisionContextBundle;
  decisions: ScoredExecutiveDecision[];
  operationalReadiness: OperationalReadinessRecord;
}): BusinessContextPayload {
  const { context, decisions, operationalReadiness } = input;
  const revenueBaseline = context.merchantBaselines.find(
    (baseline) => baseline.baselineType === "revenue",
  );
  const topRisks = decisions
    .filter((decision) => decision.category === "risk" || decision.severity === "critical")
    .slice(0, 5)
    .map(toContextDecision);
  const topOpportunities = decisions
    .filter((decision) => decision.estimatedRevenueImpact > 0)
    .slice(0, 8)
    .map(toContextDecision);

  return {
    businessSummary: {
      stage: context.learningReadiness?.stage ?? "initializing",
      overallConfidencePercent:
        context.learningReadiness?.overallConfidencePercent ?? 0,
      quickWinCount: context.quickWinSummary?.totalWins ?? context.quickWins.length,
      estimatedRevenueOpportunity:
        context.quickWinSummary?.estimatedRevenueOpportunity ?? 0,
      graphNodes: context.graphStats.totalNodes,
      graphEdges: context.graphStats.totalEdges,
      patternCount: context.patternSeeds.length,
    },
    storeHealth: {
      operationalReadinessScore: operationalReadiness.score,
      inventoryScore: operationalReadiness.inventoryScore,
      pricingScore: operationalReadiness.pricingScore,
      seoScore: operationalReadiness.seoScore,
      operationalRiskScore: operationalReadiness.operationalRiskScore,
    },
    businessDna: context.businessDna ?? {},
    topRisks,
    topOpportunities,
    priorityDecisions: decisions.slice(0, 12),
    revenueOpportunities: topOpportunities.map((item) => ({
      title: item.title,
      estimatedRevenueImpact: item.estimatedRevenueImpact,
      category: item.category,
      confidence: item.confidence,
    })),
    historicalContext: {
      memory: context.historicalMemory ?? {},
      patterns: context.patternSeeds.map((seed) => ({
        patternType: seed.patternType,
        semanticLabel: seed.semanticLabel,
        confidence: seed.confidence,
      })),
      baselines: context.merchantBaselines,
    },
    merchantProfile: {
      learningPriorities: context.learningPriorities,
      confidenceByDomain: Object.fromEntries(
        context.confidenceSeeds.map((seed) => [seed.domain, seed.confidencePercent]),
      ),
      revenueBaseline: revenueBaseline?.baselineJson ?? {},
    },
    operationalReadiness,
    recentChanges: context.quickWins.slice(0, 5).map((win) => ({
      type: "quick_win",
      title: win.title,
      affectedCount: win.affectedCount,
    })),
    predictionReadiness: {
      score: operationalReadiness.predictionReadinessScore,
      ready: operationalReadiness.predictionReadinessScore >= 60,
    },
    experimentReadiness: {
      ready: operationalReadiness.score >= 55 && decisions.length >= 3,
      candidateCount: decisions.filter((decision) => decision.category === "growth")
        .length,
    },
    quickWinSummary: context.quickWinSummary,
    generatedAt: new Date().toISOString(),
  };
}

export function hashBusinessContext(context: BusinessContextPayload): string {
  return createHash("sha256")
    .update(JSON.stringify(context))
    .digest("hex");
}

function toContextDecision(decision: ScoredExecutiveDecision) {
  return {
    id: decision.id,
    title: decision.title,
    category: decision.category,
    severity: decision.severity,
    estimatedRevenueImpact: decision.estimatedRevenueImpact,
    confidence: decision.confidence,
    recommendation: decision.recommendation,
    evidenceIds: decision.evidenceIds,
  };
}
