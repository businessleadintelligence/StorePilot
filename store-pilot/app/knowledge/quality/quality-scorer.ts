import type { QualityScores } from "../shared/types";

export type QualityInput = {
  sourcePriority: number;
  observedAt: Date;
  referenceAt?: Date;
  fieldsPresent: number;
  fieldsExpected: number;
  observationCount?: number;
};

export function computeQualityScores(input: QualityInput): QualityScores {
  const referenceAt = input.referenceAt ?? new Date();
  const freshnessMinutes = Math.max(
    0,
    Math.floor((referenceAt.getTime() - input.observedAt.getTime()) / 60_000),
  );
  const completeness =
    input.fieldsExpected > 0
      ? Math.min(1, input.fieldsPresent / input.fieldsExpected)
      : 1;
  const reliability = Math.min(1, 0.6 + completeness * 0.4);
  const confidence = Math.min(
    1,
    reliability * 0.7 + completeness * 0.2 + (input.sourcePriority >= 100 ? 0.1 : 0.05),
  );

  return {
    confidence: roundScore(confidence),
    freshnessMinutes,
    completeness: roundScore(completeness),
    reliability: roundScore(reliability),
    observationCount: input.observationCount ?? 1,
    sourcePriority: input.sourcePriority,
  };
}

function roundScore(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
