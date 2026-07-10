import type { LearningStage } from "@prisma/client";

import type { LearningDurationEstimate } from "../shared/types";

export function buildLearningEta(input: {
  duration: LearningDurationEstimate;
  historyMonthsDisplay: number;
  startedAt?: Date;
}): {
  bootstrapDurationMinutes: number;
  historicalImportMinutes: number;
  graphBuildMinutes: number;
  quickWinMinutes: number;
  totalEstimatedMinutes: number;
  estimatedCompletionAt: Date;
  historyMonthsDisplay: number;
  merchantHeadline: string;
} {
  const startedAt = input.startedAt ?? new Date();
  const estimatedCompletionAt = new Date(
    startedAt.getTime() + input.duration.totalEstimatedMinutes * 60_000,
  );
  const merchantHeadline = `Analyzing approximately ${input.historyMonthsDisplay} months of your business history.`;

  return {
    bootstrapDurationMinutes: input.duration.bootstrapDurationMinutes,
    historicalImportMinutes: input.duration.historicalImportMinutes,
    graphBuildMinutes: input.duration.graphBuildMinutes,
    quickWinMinutes: input.duration.quickWinMinutes,
    totalEstimatedMinutes: input.duration.totalEstimatedMinutes,
    estimatedCompletionAt,
    historyMonthsDisplay: input.historyMonthsDisplay,
    merchantHeadline,
  };
}

export function formatEtaMinutes(minutes: number): string {
  if (minutes <= 1) {
    return "1 minute";
  }
  return `${minutes} minutes`;
}

export function shouldAdvanceStage(current: LearningStage, target: LearningStage): boolean {
  const order: LearningStage[] = [
    "initializing",
    "historical_import",
    "learning",
    "operational",
    "predictive",
    "adaptive",
  ];
  return order.indexOf(target) > order.indexOf(current);
}
