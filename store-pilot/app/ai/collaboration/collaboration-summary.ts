import type {
  CollaborationContext,
  CollaborationExecutiveAction,
  CollaborationOutput,
} from "./collaboration-types";
import { agentLabel } from "./collaboration-utils";
import { calculateCollaborationExpectedImpact } from "./collaboration-impact";
import { calculateCollaborationConsensusScore, calculateCollaborationOverallHealth } from "./collaboration-health";
import { deriveOverallPriority } from "./collaboration-priority";
import { selectTopExecutiveActions } from "./collaboration-ranking";

export function buildDeterministicCollaborationSummary(input: {
  context: CollaborationContext;
  executiveActions: CollaborationExecutiveAction[];
  conflicts: CollaborationOutput["conflicts"];
}): string {
  const topActions = selectTopExecutiveActions(input.executiveActions, 3);
  const agentNames = [...new Set(input.executiveActions.flatMap((action) => action.agentsInvolved))]
    .slice(0, 4)
    .map(agentLabel);

  if (topActions.length === 0) {
    return "No cross-agent executive actions are ready yet. Run the production AI specialists to populate recommendations.";
  }

  const actionLine = topActions.map((action) => action.title).join("; ");
  const conflictLine =
    input.conflicts.length > 0
      ? `${input.conflicts.length} cross-agent conflict(s) require manual review before execution.`
      : "No blocking cross-agent conflicts were detected.";

  return `${agentNames.join(", ")} aligned on ${topActions.length} executive priorities: ${actionLine}. ${conflictLine}`;
}

export function buildCollaborationOpportunities(actions: CollaborationExecutiveAction[]): string[] {
  return actions
    .filter((action) => action.estimatedRevenueImpact > 0)
    .slice(0, 5)
    .map((action) => `${action.title} (${Math.round(action.confidence * 100)}% confidence)`);
}

export function buildCollaborationRisks(input: {
  actions: CollaborationExecutiveAction[];
  conflicts: CollaborationOutput["conflicts"];
}): string[] {
  const risks = input.conflicts.map((conflict) => conflict.title);
  for (const action of input.actions.filter((item) => item.risk === "high")) {
    risks.push(`${action.title} carries elevated execution risk`);
  }
  return risks.slice(0, 5);
}

export function buildCollaborationTimeline(computedAt: string) {
  return {
    detected: computedAt,
    synthesized: computedAt,
    reviewed: null,
    implemented: null,
    verified: null,
  };
}

export function finalizeCollaborationOutput(input: {
  context: CollaborationContext;
  executiveActions: CollaborationExecutiveAction[];
  conflicts: CollaborationOutput["conflicts"];
  dependencies: CollaborationOutput["dependencies"];
  summary?: string;
}): CollaborationOutput {
  const rankedActions = selectTopExecutiveActions(input.executiveActions, 100);
  const topFive = selectTopExecutiveActions(rankedActions, 5);
  const expectedImpact = calculateCollaborationExpectedImpact(rankedActions);
  const overallHealth = calculateCollaborationOverallHealth(input.context);
  const overallConfidence =
    rankedActions.length > 0
      ? rankedActions.reduce((total, action) => total + action.confidence, 0) / rankedActions.length
      : 0;
  const consensusScore = calculateCollaborationConsensusScore({
    actionCount: rankedActions.length,
    reinforcedCount: rankedActions.filter((action) => action.reinforced).length,
    conflictCount: input.conflicts.length,
    agentCount: input.context.agentResults.length,
  });

  return {
    summary:
      input.summary ??
      buildDeterministicCollaborationSummary({
        context: input.context,
        executiveActions: rankedActions,
        conflicts: input.conflicts,
      }),
    overallHealth,
    overallConfidence: Number(overallConfidence.toFixed(2)),
    overallPriority: deriveOverallPriority(rankedActions),
    consensusScore,
    executiveActions: topFive,
    conflicts: input.conflicts,
    dependencies: input.dependencies,
    recommendationGroups: [...new Set(rankedActions.map((action) => action.group))].map((group) => ({
      group,
      actionIds: rankedActions.filter((action) => action.group === group).map((action) => action.id),
    })),
    opportunities: buildCollaborationOpportunities(rankedActions),
    risks: buildCollaborationRisks({ actions: rankedActions, conflicts: input.conflicts }),
    expectedImpact,
    timeline: buildCollaborationTimeline(input.context.computedAt),
    topRisk: buildCollaborationRisks({ actions: rankedActions, conflicts: input.conflicts })[0] ?? null,
    topOpportunity: buildCollaborationOpportunities(rankedActions)[0] ?? null,
  };
}
