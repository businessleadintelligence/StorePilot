import type { DecisionTaskRecord, ScoredExecutiveDecision } from "../shared/types";

export function convertDecisionToTask(
  decision: ScoredExecutiveDecision,
): Omit<DecisionTaskRecord, "id" | "status"> & { decisionId: string } {
  return {
    decisionId: decision.id,
    title: decision.title,
    description: decision.recommendation,
    reason: buildTaskReason(decision),
    evidenceIds: decision.evidenceIds,
    graphNodeIds: decision.graphNodeIds,
    businessMemoryIds: decision.businessMemoryIds,
    businessImpact: decision.businessImpact,
    estimatedEffort: decision.estimatedEffort,
    estimatedTimeMinutes: decision.estimatedTimeMinutes,
    confidence: decision.confidence,
  };
}

function buildTaskReason(decision: ScoredExecutiveDecision): string {
  const factTypes = decision.historicalContext.sourceFactTypes;
  if (Array.isArray(factTypes) && factTypes.length > 0) {
    return `Evidence: ${factTypes.join(", ")}`;
  }
  if (decision.sourceEngine === "pattern_discovery") {
    return "Historical pattern detected in business memory";
  }
  return `Source engine: ${decision.sourceEngine}`;
}

export function convertDecisionsToTasks(
  decisions: ScoredExecutiveDecision[],
): Array<Omit<DecisionTaskRecord, "id" | "status"> & { decisionId: string }> {
  return decisions.map(convertDecisionToTask);
}
