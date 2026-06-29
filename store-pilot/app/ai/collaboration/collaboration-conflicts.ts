import type {
  CollaborationConflict,
  CollaborationRecommendationInput,
} from "./collaboration-types";
import {
  agentLabel,
  isDecliningTrendAction,
  isEmergingTrendAction,
  isInventoryDecreaseAction,
  isInventoryIncreaseAction,
  recommendationsShareProduct,
} from "./collaboration-utils";

export function detectCollaborationConflicts(
  recommendations: CollaborationRecommendationInput[],
): CollaborationConflict[] {
  const conflicts: CollaborationConflict[] = [];

  for (let index = 0; index < recommendations.length; index += 1) {
    for (let inner = index + 1; inner < recommendations.length; inner += 1) {
      const left = recommendations[index]!;
      const right = recommendations[inner]!;

      if (!recommendationsShareProduct(left, right)) {
        continue;
      }

      const leftIncrease = isInventoryIncreaseAction(left) || isEmergingTrendAction(left);
      const rightDecrease = isInventoryDecreaseAction(right) || isDecliningTrendAction(right);
      const rightIncrease = isInventoryIncreaseAction(right) || isEmergingTrendAction(right);
      const leftDecrease = isInventoryDecreaseAction(left) || isDecliningTrendAction(left);

      if ((leftIncrease && rightDecrease) || (rightIncrease && leftDecrease)) {
        conflicts.push({
          id: `conflict:${left.recommendationId}:${right.recommendationId}`,
          title: `Conflicting guidance for ${left.productTitle ?? left.title}`,
          agents: [left.agentId, right.agentId],
          recommendations: [left.recommendationId, right.recommendationId],
          reason:
            leftIncrease && rightDecrease
              ? `${agentLabel(left.agentId)} recommends increasing demand coverage while ${agentLabel(right.agentId)} recommends reducing exposure.`
              : `${agentLabel(right.agentId)} recommends increasing demand coverage while ${agentLabel(left.agentId)} recommends reducing exposure.`,
          resolution: "Review supplier lead time, current inventory coverage, and recent demand trend before executing either action.",
          severity: "high",
        });
      }
    }
  }

  return dedupeConflicts(conflicts);
}

function dedupeConflicts(conflicts: CollaborationConflict[]): CollaborationConflict[] {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = [...conflict.recommendations].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function conflictBlocksAutoExecution(conflict: CollaborationConflict): boolean {
  return conflict.severity === "high";
}
