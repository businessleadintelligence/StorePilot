import type { ExperimentConfidenceBreakdown, ExperimentContextBundle, ExperimentRecord } from "../shared/types";

export function computeExperimentConfidence(input: {
  experiment: ExperimentRecord;
  context: ExperimentContextBundle;
  observationCount: number;
}): ExperimentConfidenceBreakdown {
  const dataCoverage = Math.min(
    0.95,
    0.4 + input.experiment.evidenceIds.length * 0.04 + input.context.graphStats.totalNodes / 2000,
  );
  const businessStability = Math.min(0.95, input.context.businessStabilityScore / 100);
  const historicalSupport = Math.min(
    0.95,
    0.35 + input.experiment.memoryIds.length * 0.08 + input.experiment.rootCauseIds.length * 0.05,
  );
  const merchantSimilarity = Math.min(
    0.9,
    0.5 + input.context.patternSeeds.length * 0.06,
  );
  const freshness = Math.min(
    0.95,
    0.55 + input.experiment.predictionIds.length * 0.08,
  );

  const confidenceScore = clamp(
    input.experiment.confidence * 0.25 +
      dataCoverage * 0.2 +
      businessStability * 0.15 +
      historicalSupport * 0.2 +
      merchantSimilarity * 0.1 +
      freshness * 0.1,
    0.55,
    0.99,
  );

  return {
    confidenceScore: round(confidenceScore),
    observationCount: input.observationCount,
    dataCoverage: round(dataCoverage),
    businessStability: round(businessStability),
    historicalSupport: round(historicalSupport),
    merchantSimilarity: round(merchantSimilarity),
    freshness: round(freshness),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
