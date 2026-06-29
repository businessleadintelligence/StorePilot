import { collaborationSchema } from "../schemas/collaboration";
import type { CollaborationContext, CollaborationOutput } from "./collaboration-types";
import { COLLABORATION_SOURCE_AGENTS } from "./collaboration-types";
import { validateCollaborationEvidenceItems } from "./collaboration-evidence";

export class CollaborationValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CollaborationValidationError";
  }
}

function isValidTimeline(timeline: string): boolean {
  return timeline.trim().length >= 3 && !/^asap$/i.test(timeline);
}

export function validateCollaborationOutput(
  context: CollaborationContext,
  output: CollaborationOutput,
): void {
  if (output.executiveActions.length === 0) {
    throw new CollaborationValidationError("empty_executive_actions");
  }

  const actionIds = new Set<string>();
  const knownRecommendationIds = new Set(
    context.recommendations.map((item) => item.recommendationId),
  );

  for (const action of output.executiveActions) {
    if (actionIds.has(action.id)) {
      throw new CollaborationValidationError("duplicate_executive_action");
    }
    actionIds.add(action.id);

    for (const agent of action.agentsInvolved) {
      if (!COLLABORATION_SOURCE_AGENTS.includes(agent)) {
        throw new CollaborationValidationError("unknown_source_agent");
      }
    }

    if (action.supportingEvidence.length === 0) {
      throw new CollaborationValidationError("missing_evidence");
    }

    try {
      validateCollaborationEvidenceItems(action.supportingEvidence, [...COLLABORATION_SOURCE_AGENTS]);
    } catch {
      throw new CollaborationValidationError("invalid_evidence");
    }

    for (const recommendationId of action.sourceRecommendationIds) {
      if (!knownRecommendationIds.has(recommendationId)) {
        throw new CollaborationValidationError("unknown_recommendation_id");
      }
    }

    if (action.priority < 1 || action.priority > 5) {
      throw new CollaborationValidationError("invalid_priority");
    }

    if (action.confidence < 0 || action.confidence > 1) {
      throw new CollaborationValidationError("invalid_confidence");
    }

    if (!action.verificationCriteria.trim()) {
      throw new CollaborationValidationError("missing_verification_criteria");
    }

    if (!isValidTimeline(action.timeline)) {
      throw new CollaborationValidationError("impossible_timeline");
    }

    if (context.memory.implementedExecutiveIds.has(action.id)) {
      throw new CollaborationValidationError("implemented_executive_action_regenerated");
    }
  }

  for (const dependency of output.dependencies) {
    if (!knownRecommendationIds.has(dependency.recommendationId)) {
      throw new CollaborationValidationError("unknown_recommendation_id");
    }
    for (const dependsOn of dependency.dependsOn) {
      if (!knownRecommendationIds.has(dependsOn)) {
        throw new CollaborationValidationError("unknown_recommendation_id");
      }
    }
  }

  const parsed = collaborationSchema.safeParse(output);
  if (!parsed.success) {
    throw new CollaborationValidationError("schema_validation_failed");
  }
}
