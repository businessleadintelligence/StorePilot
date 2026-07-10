import type { RootCauseRecord } from "../shared/types";

export function rankRootCauses(causes: RootCauseRecord[]): RootCauseRecord[] {
  return [...causes].sort((left, right) => {
    if (right.rankScore !== left.rankScore) {
      return right.rankScore - left.rankScore;
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return right.impactEstimate.revenueImpact - left.impactEstimate.revenueImpact;
  });
}

export function computeRankScore(cause: RootCauseRecord): number {
  return roundScore(
    cause.confidence * 100 * 0.35 +
      cause.impactEstimate.urgency * 0.25 +
      Math.min(30, cause.impactEstimate.revenueImpact / 50) * 0.25 +
      cause.evidenceIds.length * 0.5,
  );
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function selectTopRootCauses(
  causes: RootCauseRecord[],
  limit = 12,
): RootCauseRecord[] {
  return rankRootCauses(causes).slice(0, limit);
}
