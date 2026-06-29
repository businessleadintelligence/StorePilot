export function calculateExecutiveConfidence(input: {
  agentConfidences: number[];
  dataFreshnessHours: number[];
  evidenceCount: number;
  conflictCount: number;
  implementedActionCount: number;
}): {
  executiveConfidence: number;
  agentConfidenceAverage: number;
  freshnessPenalty: number;
  issues: string[];
} {
  const issues: string[] = [];
  const validConfidences = input.agentConfidences.filter((value) => Number.isFinite(value));
  const agentConfidenceAverage =
    validConfidences.length > 0
      ? validConfidences.reduce((sum, value) => sum + value, 0) / validConfidences.length
      : 0.5;

  const staleAgents = input.dataFreshnessHours.filter((hours) => hours > 72).length;
  const freshnessPenalty = Math.min(0.25, staleAgents * 0.04 + Math.max(0, ...input.dataFreshnessHours.map((h) => h - 48)) * 0.001);
  const evidenceBoost = Math.min(0.15, input.evidenceCount * 0.01);
  const trackRecordBoost = Math.min(0.12, input.implementedActionCount * 0.02);
  const conflictPenalty = Math.min(0.2, input.conflictCount * 0.04);

  let executiveConfidence =
    agentConfidenceAverage + evidenceBoost + trackRecordBoost - freshnessPenalty - conflictPenalty;
  executiveConfidence = Math.max(0, Math.min(1, Number(executiveConfidence.toFixed(2))));

  if (staleAgents > 0) issues.push("stale_agent_data");
  if (input.conflictCount >= 3) issues.push("confidence_reduced_by_conflicts");

  return {
    executiveConfidence,
    agentConfidenceAverage: Number(agentConfidenceAverage.toFixed(2)),
    freshnessPenalty: Number(freshnessPenalty.toFixed(2)),
    issues,
  };
}
