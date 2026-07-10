import type { DecisionContextBundle, ScoredExecutiveDecision } from "../../shared/types";

export function scoreExecutiveDecision(
  decision: ScoredExecutiveDecision,
  context: DecisionContextBundle,
): ScoredExecutiveDecision {
  const merchantPriorityBoost = computeMerchantPriorityBoost(decision, context);
  const readinessBoost = (context.learningReadiness?.overallConfidencePercent ?? 50) / 200;
  const quickWinBoost =
    decision.sourceEngine === "quick_wins" ? decision.rankScore * 0.05 : 0;

  const rankScore = roundScore(
    decision.businessImpact * 0.3 +
      decision.urgency * 0.25 +
      decision.confidence * 100 * 0.2 +
      Math.min(20, decision.estimatedRevenueImpact / 50) * 0.15 +
      merchantPriorityBoost * 0.05 +
      readinessBoost * 10 +
      quickWinBoost,
  );

  return {
    ...decision,
    priority: Math.round(rankScore),
    rankScore,
  };
}

function computeMerchantPriorityBoost(
  decision: ScoredExecutiveDecision,
  context: DecisionContextBundle,
): number {
  const domainMap: Record<string, string[]> = {
    inventory: ["inventory"],
    pricing: ["pricing"],
    seo: ["seo"],
    collections: ["collections"],
    operations: ["operations"],
    catalog: ["products"],
    growth: ["seasonality", "products"],
    risk: ["operations", "inventory"],
    bundles: ["products"],
  };

  const domains = domainMap[decision.category] ?? [];
  const matchingPriority = context.learningPriorities.find((priority) =>
    domains.includes(priority.domain),
  );

  if (!matchingPriority) {
    return 0;
  }

  return Math.max(0, 10 - matchingPriority.priorityOrder);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreExecutiveDecisions(
  decisions: ScoredExecutiveDecision[],
  context: DecisionContextBundle,
): ScoredExecutiveDecision[] {
  return decisions.map((decision) => scoreExecutiveDecision(decision, context));
}
