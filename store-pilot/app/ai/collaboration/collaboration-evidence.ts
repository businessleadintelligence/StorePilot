import type {
  CollaborationEvidenceItem,
  CollaborationRecommendationInput,
  CollaborationSourceAgent,
} from "./collaboration-types";
import { agentLabel } from "./collaboration-utils";

export function buildCollaborationEvidenceItem(input: {
  recommendation: CollaborationRecommendationInput;
  index: number;
}): CollaborationEvidenceItem {
  const key =
    input.recommendation.evidenceKeys[0] ??
    `${input.recommendation.agentId}_${input.recommendation.recommendationId}_${input.index}`;

  return {
    key,
    sourceAgent: input.recommendation.agentId,
    factReference: input.recommendation.evidence[0] ?? input.recommendation.reason,
    confidence: input.recommendation.confidence,
    label: `${agentLabel(input.recommendation.agentId)}: ${input.recommendation.title}`,
  };
}

export function buildCollaborationEvidenceForRecommendations(
  recommendations: CollaborationRecommendationInput[],
): CollaborationEvidenceItem[] {
  return recommendations.map((recommendation, index) =>
    buildCollaborationEvidenceItem({ recommendation, index }),
  );
}

export function validateCollaborationEvidenceItems(
  evidence: CollaborationEvidenceItem[],
  allowedAgents: CollaborationSourceAgent[],
): void {
  for (const item of evidence) {
    if (!allowedAgents.includes(item.sourceAgent)) {
      throw new Error(`unknown_source_agent:${item.sourceAgent}`);
    }
    if (!item.key.trim() || !item.factReference.trim()) {
      throw new Error("missing_evidence");
    }
    if (item.confidence < 0 || item.confidence > 1) {
      throw new Error("invalid_confidence");
    }
  }
}

export function resolveEvidenceKeys(
  recommendations: CollaborationRecommendationInput[],
): string[] {
  return recommendations.flatMap((recommendation) =>
    recommendation.evidenceKeys.length > 0
      ? recommendation.evidenceKeys
      : [`${recommendation.agentId}:${recommendation.recommendationId}`],
  );
}
