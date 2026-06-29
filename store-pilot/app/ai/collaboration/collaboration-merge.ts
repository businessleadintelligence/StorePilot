import type {
  CollaborationExecutiveAction,
  CollaborationImpactMetrics,
  CollaborationRecommendationInput,
} from "./collaboration-types";
import { recommendationsShareProduct } from "./collaboration-utils";
import { buildCollaborationEvidenceForRecommendations } from "./collaboration-evidence";
import { assignCollaborationExecutiveGroup } from "./collaboration-groups";
import { aggregateCollaborationImpact, calculateExecutiveActionImpact } from "./collaboration-impact";
import { calculateExecutivePriorityScore } from "./collaboration-priority";
import { detectCollaborationConflicts } from "./collaboration-conflicts";

export type CollaborationMergeCluster = {
  key: string;
  recommendations: CollaborationRecommendationInput[];
  reinforced: boolean;
};

export function clusterRecommendationsForMerge(
  recommendations: CollaborationRecommendationInput[],
): CollaborationMergeCluster[] {
  const clusters: CollaborationMergeCluster[] = [];

  for (const recommendation of recommendations) {
    const existing = clusters.find((cluster) =>
      cluster.recommendations.some((candidate) =>
        recommendationsShareProduct(candidate, recommendation),
      ),
    );

    if (existing) {
      existing.recommendations.push(recommendation);
      existing.reinforced = existing.recommendations.length >= 3;
      continue;
    }

    clusters.push({
      key: recommendation.productId ?? recommendation.recommendationId,
      recommendations: [recommendation],
      reinforced: false,
    });
  }

  return clusters;
}

function buildExecutiveActionId(recommendations: CollaborationRecommendationInput[]): string {
  const sorted = [...recommendations].sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId),
  );
  return `executive:${sorted.map((item) => item.recommendationId).join(":")}`.slice(0, 120);
}

function mergeMerchantActions(recommendations: CollaborationRecommendationInput[]): string[] {
  return [...new Set(recommendations.flatMap((item) => item.merchantAction))].slice(0, 6);
}

function mergeVerificationCriteria(recommendations: CollaborationRecommendationInput[]): string {
  return recommendations
    .map((item) => item.verificationCriteria)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function mergeTimeline(recommendations: CollaborationRecommendationInput[]): string {
  const timelines = recommendations.map((item) => item.timeline).filter(Boolean);
  return timelines[0] ?? "2-4 weeks";
}

function deriveRisk(recommendations: CollaborationRecommendationInput[]): "low" | "medium" | "high" {
  if (recommendations.some((item) => item.group === "Critical Risks" || item.priority === 1)) {
    return "high";
  }
  if (recommendations.some((item) => item.priority <= 2)) {
    return "medium";
  }
  return "low";
}

function applyReinforcementBoost(input: {
  priority: number;
  confidence: number;
  impact: CollaborationImpactMetrics;
  reinforced: boolean;
}) {
  if (!input.reinforced) {
    return input;
  }

  return {
    priority: Math.max(1, input.priority - 1),
    confidence: Math.min(0.99, Number((input.confidence + 0.08).toFixed(2))),
    impact: {
      revenueOpportunity: input.impact.revenueOpportunity * 1.15,
      revenueRecovered: input.impact.revenueRecovered * 1.15,
      inventoryReduction: input.impact.inventoryReduction * 1.1,
      conversionLift: input.impact.conversionLift * 1.1,
      ordersProtected: input.impact.ordersProtected * 1.1,
    },
  };
}

export function mergeRecommendationsIntoExecutiveActions(input: {
  recommendations: CollaborationRecommendationInput[];
  conflicts: ReturnType<typeof detectCollaborationConflicts>;
}): CollaborationExecutiveAction[] {
  const conflictRecommendationIds = new Set(
    input.conflicts.flatMap((conflict) => conflict.recommendations),
  );
  const clusters = clusterRecommendationsForMerge(input.recommendations);

  return clusters.map((cluster) => {
    const impact = aggregateCollaborationImpact(cluster.recommendations);
    const reinforced = cluster.recommendations.length >= 3;
    const boosted = applyReinforcementBoost({
      priority: Math.min(...cluster.recommendations.map((item) => item.priority)),
      confidence:
        cluster.recommendations.reduce((total, item) => total + item.confidence, 0) /
        cluster.recommendations.length,
      impact,
      reinforced,
    });
    const executiveImpact = calculateExecutiveActionImpact(boosted.impact);
    const primary = [...cluster.recommendations].sort(
      (left, right) => left.priority - right.priority || right.priorityScore - left.priorityScore,
    )[0]!;
    const agentsInvolved = [...new Set(cluster.recommendations.map((item) => item.agentId))];
    const requiresManualReview = cluster.recommendations.some((item) =>
      conflictRecommendationIds.has(item.recommendationId),
    );

    return {
      id: buildExecutiveActionId(cluster.recommendations),
      title:
        cluster.recommendations.length > 1
          ? `Launch coordinated action for ${primary.productTitle ?? primary.title}`
          : primary.title,
      summary:
        cluster.recommendations.length > 1
          ? `${agentsInvolved.length} agents aligned on ${primary.productTitle ?? "this opportunity"}.`
          : primary.reason,
      reason: cluster.recommendations.map((item) => item.reason).join(" "),
      agentsInvolved,
      supportingEvidence: buildCollaborationEvidenceForRecommendations(cluster.recommendations),
      sourceRecommendationIds: cluster.recommendations.map((item) => item.recommendationId),
      priority: boosted.priority,
      confidence: boosted.confidence,
      risk: deriveRisk(cluster.recommendations),
      estimatedRevenueImpact: executiveImpact.revenueImpact,
      estimatedInventoryImpact: executiveImpact.inventoryImpact,
      estimatedConversionImpact: executiveImpact.conversionImpact,
      estimatedDifficulty: primary.difficulty,
      merchantActions: mergeMerchantActions(cluster.recommendations),
      verificationCriteria: mergeVerificationCriteria(cluster.recommendations) || "Track KPI movement within the expected window.",
      timeline: mergeTimeline(cluster.recommendations),
      group: assignCollaborationExecutiveGroup(primary),
      reinforced,
      requiresManualReview,
      priorityScore: calculateExecutivePriorityScore({
        priority: boosted.priority,
        confidence: boosted.confidence,
        revenueImpact: executiveImpact.revenueImpact,
        risk: deriveRisk(cluster.recommendations),
        reinforced,
        agentCount: agentsInvolved.length,
        difficulty: primary.difficulty,
      }),
    } as CollaborationExecutiveAction & { priorityScore: number };
  }) as CollaborationExecutiveAction[];
}
