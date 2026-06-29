import { randomUUID } from "node:crypto";
import type { AIPersistenceRepositories } from "../persistence/types";
import type { CollaborationOutput } from "./collaboration-types";
import { buildCollaborationSubjectKey } from "./collaboration-utils";
import { mapCandidatesToRecommendations } from "../recommendations/recommendation-engine";

export async function persistCollaborationOutput(input: {
  storeId: string;
  runId: string;
  output: CollaborationOutput;
  persistence: AIPersistenceRepositories;
}) {
  const subjectKey = buildCollaborationSubjectKey(input.storeId);
  const inputFingerprint = `collaboration:${input.storeId}:${input.output.executiveActions.length}:${input.output.conflicts.length}`;

  await input.persistence.results.create({
    id: randomUUID(),
    runId: input.runId,
    storeId: input.storeId,
    agentId: "executive_summary",
    subjectKey,
    inputFingerprint,
    resultJson: input.output as unknown as Record<string, unknown>,
    summary: input.output.summary,
    priority: input.output.overallPriority,
    confidence: input.output.overallConfidence,
    isSuccess: true,
    expiresAt: null,
  });

  const candidates = input.output.executiveActions.map((action) => ({
    category: action.group,
    title: action.title,
    summary: action.summary,
    priority: action.priority,
    confidence: action.confidence,
    payload: {
      id: action.id,
      reason: action.reason,
      group: action.group,
      agentsInvolved: action.agentsInvolved,
      supportingEvidence: action.supportingEvidence,
      sourceRecommendationIds: action.sourceRecommendationIds,
      estimatedImpact: {
        revenueOpportunity: action.estimatedRevenueImpact,
        inventoryCostSaved: action.estimatedInventoryImpact,
        marginImprovement: action.estimatedConversionImpact,
      },
      merchantAction: action.merchantActions,
      verificationCriteria: action.verificationCriteria,
      timeline: input.output.timeline,
      reinforced: action.reinforced,
      requiresManualReview: action.requiresManualReview,
      executiveActionId: action.id,
      conflicts: input.output.conflicts.filter((conflict) =>
        conflict.recommendations.some((id) => action.sourceRecommendationIds.includes(id)),
      ),
      dependencies: input.output.dependencies.filter(
        (dependency) =>
          action.sourceRecommendationIds.includes(dependency.recommendationId) ||
          dependency.dependsOn.some((id) => action.sourceRecommendationIds.includes(id)),
      ),
    },
  }));

  await input.persistence.recommendations.upsertMany(
    mapCandidatesToRecommendations({
      storeId: input.storeId,
      agentId: "executive_summary",
      subjectKey,
      runId: input.runId,
      candidates,
    }).map((record) => ({ ...record, status: "open" })),
  );
}

export async function loadLatestCollaborationOutputFromStore(input: {
  storeId: string;
}): Promise<CollaborationOutput | null> {
  const prisma = (await import("../../db.server")).default;
  const latest = await prisma.aiAgentResult.findFirst({
    where: {
      storeId: input.storeId,
      agentId: "executive_summary",
      subjectKey: buildCollaborationSubjectKey(input.storeId),
      isSuccess: true,
    },
    orderBy: { createdAt: "desc" },
    select: { resultJson: true },
  });

  return (latest?.resultJson as CollaborationOutput | undefined) ?? null;
}
