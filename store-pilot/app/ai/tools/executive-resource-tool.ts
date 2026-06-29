export function analyzeResourceLoad(input: {
  inProgressOperations: number;
  pendingOperations: number;
  activeAutomations: number;
  merchantCapacityScore: number;
  parallelWorkstreams: number;
}): {
  resourceLoadScore: number;
  utilizationPercent: number;
  headroomPercent: number;
  issues: string[];
} {
  const issues: string[] = [];
  const activeUnits = input.inProgressOperations + input.activeAutomations * 0.5;
  const queuedUnits = input.pendingOperations;
  const capacityUnits = Math.max(1, input.parallelWorkstreams);

  const utilizationPercent = Math.max(
    0,
    Math.min(100, Math.round(((activeUnits + queuedUnits * 0.4) / (capacityUnits * 2)) * 100)),
  );
  const headroomPercent = Math.max(0, 100 - utilizationPercent);

  let resourceLoadScore = Math.round(input.merchantCapacityScore * 0.6 + headroomPercent * 0.4);
  if (utilizationPercent >= 90) {
    resourceLoadScore -= 15;
    issues.push("resource_utilization_critical");
  } else if (utilizationPercent >= 75) {
    issues.push("resource_utilization_high");
  }

  resourceLoadScore = Math.max(0, Math.min(100, resourceLoadScore));

  return { resourceLoadScore, utilizationPercent, headroomPercent, issues };
}
