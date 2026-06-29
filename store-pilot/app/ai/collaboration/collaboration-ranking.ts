import type { CollaborationExecutiveAction } from "./collaboration-types";

export function rankExecutiveActions(actions: CollaborationExecutiveAction[]): CollaborationExecutiveAction[] {
  return [...actions].sort(
    (left, right) =>
      left.priority - right.priority ||
      right.confidence - left.confidence ||
      right.estimatedRevenueImpact - left.estimatedRevenueImpact,
  );
}

export function selectTopExecutiveActions(
  actions: CollaborationExecutiveAction[],
  limit = 5,
): CollaborationExecutiveAction[] {
  return rankExecutiveActions(actions).slice(0, limit);
}
