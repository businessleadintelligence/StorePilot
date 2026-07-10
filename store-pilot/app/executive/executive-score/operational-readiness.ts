import { OPERATIONAL_READINESS_WEIGHTS } from "../shared/constants";
import type { DecisionContextBundle, OperationalReadinessRecord } from "../shared/types";

export function computeOperationalReadiness(
  context: DecisionContextBundle,
): OperationalReadinessRecord {
  const confidenceByDomain = Object.fromEntries(
    context.confidenceSeeds.map((seed) => [seed.domain, seed.confidencePercent]),
  );

  const inventoryScore = confidenceByDomain.inventory ?? 50;
  const pricingScore = confidenceByDomain.pricing ?? 45;
  const seoScore = confidenceByDomain.seo ?? 40;
  const collectionsScore = confidenceByDomain.collections ?? 42;
  const automationScore = estimateAutomationScore(context);
  const operationalRiskScore = estimateOperationalRiskScore(context);
  const executionCapacityScore = estimateExecutionCapacityScore(context);
  const knowledgeConfidenceScore =
    context.learningReadiness?.overallConfidencePercent ?? 50;
  const historicalStabilityScore = estimateHistoricalStabilityScore(context);
  const predictionReadinessScore = estimatePredictionReadinessScore(context);

  const weighted =
    inventoryScore * OPERATIONAL_READINESS_WEIGHTS.inventory +
    pricingScore * OPERATIONAL_READINESS_WEIGHTS.pricing +
    seoScore * OPERATIONAL_READINESS_WEIGHTS.seo +
    collectionsScore * OPERATIONAL_READINESS_WEIGHTS.collections +
    automationScore * OPERATIONAL_READINESS_WEIGHTS.automation +
    operationalRiskScore * OPERATIONAL_READINESS_WEIGHTS.operationalRisk +
    executionCapacityScore * OPERATIONAL_READINESS_WEIGHTS.executionCapacity +
    knowledgeConfidenceScore * OPERATIONAL_READINESS_WEIGHTS.knowledgeConfidence +
    historicalStabilityScore * OPERATIONAL_READINESS_WEIGHTS.historicalStability +
    predictionReadinessScore * OPERATIONAL_READINESS_WEIGHTS.predictionReadiness;

  return {
    score: Math.round(clamp(weighted, 0, 100)),
    inventoryScore,
    pricingScore,
    seoScore,
    collectionsScore,
    automationScore,
    operationalRiskScore,
    executionCapacityScore,
    knowledgeConfidenceScore,
    historicalStabilityScore,
    predictionReadinessScore,
  };
}

function estimateAutomationScore(context: DecisionContextBundle): number {
  const graphFactor = Math.min(30, context.graphStats.totalNodes / 20);
  const memoryFactor = context.historicalMemory ? 20 : 0;
  return Math.round(clamp(40 + graphFactor + memoryFactor, 0, 100));
}

function estimateOperationalRiskScore(context: DecisionContextBundle): number {
  const riskWins = context.quickWins.filter(
    (win) =>
      win.category === "inventory" ||
      win.winType === "high_refund_risk" ||
      win.winType === "inventory_risk",
  );
  const riskPenalty = Math.min(40, riskWins.length * 8);
  return Math.round(clamp(100 - riskPenalty, 20, 100));
}

function estimateExecutionCapacityScore(context: DecisionContextBundle): number {
  const openTaskEstimate = context.quickWins.length;
  const penalty = Math.min(35, openTaskEstimate * 2);
  return Math.round(clamp(85 - penalty, 25, 100));
}

function estimateHistoricalStabilityScore(context: DecisionContextBundle): number {
  const growthPattern = context.patternSeeds.find(
    (seed) => seed.patternType === "order_growth",
  );
  if (!growthPattern) {
    return 60;
  }
  const growthRate =
    typeof growthPattern.patternJson.growthRate === "number"
      ? growthPattern.patternJson.growthRate
      : 0;
  if (growthRate >= 0) {
    return Math.round(clamp(60 + growthRate * 100, 60, 95));
  }
  return Math.round(clamp(60 + growthRate * 80, 30, 60));
}

function estimatePredictionReadinessScore(context: DecisionContextBundle): number {
  const hasDna = Boolean(context.businessDna);
  const hasPatterns = context.patternSeeds.length >= 3;
  const graphReady = context.graphStats.totalNodes >= 100;
  let score = 20;
  if (hasDna) score += 25;
  if (hasPatterns) score += 25;
  if (graphReady) score += 20;
  if (context.learningReadiness?.stage === "operational") score += 10;
  return Math.round(clamp(score, 0, 100));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
