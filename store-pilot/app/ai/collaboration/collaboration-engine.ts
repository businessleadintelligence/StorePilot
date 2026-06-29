import type { CollaborationContext, CollaborationOutput } from "./collaboration-types";
import { detectCollaborationConflicts } from "./collaboration-conflicts";
import { detectCollaborationDependencies } from "./collaboration-dependencies";
import { mergeRecommendationsIntoExecutiveActions } from "./collaboration-merge";
import { applyCollaborationMemory } from "./collaboration-memory";
import { finalizeCollaborationOutput } from "./collaboration-summary";
import { validateCollaborationOutput } from "./collaboration-validator";
import { rankExecutiveActions } from "./collaboration-ranking";

export function runCollaborationEngine(context: CollaborationContext): CollaborationOutput {
  const conflicts = detectCollaborationConflicts(context.recommendations);
  const dependencies = detectCollaborationDependencies(context.recommendations);
  const mergedActions = mergeRecommendationsIntoExecutiveActions({
    recommendations: context.recommendations,
    conflicts,
  });
  const memoryFiltered = applyCollaborationMemory(mergedActions, context.memory);
  const rankedActions = rankExecutiveActions(memoryFiltered);

  const output = finalizeCollaborationOutput({
    context,
    executiveActions: rankedActions,
    conflicts,
    dependencies,
  });

  validateCollaborationOutput(context, output);
  return output;
}
