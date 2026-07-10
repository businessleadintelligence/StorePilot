import type {
  ConfidenceBreakdown,
  RootCauseContextBundle,
  SignalSnapshot,
} from "../shared/types";

export function computeCauseConfidence(input: {
  evidenceIds: string[];
  signals: SignalSnapshot[];
  context: RootCauseContextBundle;
  patternSupport: number;
}): ConfidenceBreakdown {
  const evidenceCount = input.evidenceIds.length;
  const graphSupport = Math.min(
    0.95,
    0.4 + input.context.graphStats.totalNodes / 1000,
  );
  const historicalSupport = Math.min(
    0.95,
    input.patternSupport + (input.context.historicalMemory ? 0.15 : 0),
  );
  const freshness = Math.min(
    0.95,
    0.5 + evidenceCount * 0.04,
  );
  const crossSourceAgreement = computeCrossSourceAgreement(input.signals);
  const confidenceScore = clamp(
    evidenceCount * 0.08 +
      graphSupport * 0.2 +
      historicalSupport * 0.25 +
      freshness * 0.2 +
      crossSourceAgreement * 0.27,
    0.35,
    0.99,
  );

  return {
    confidenceScore: round(confidenceScore),
    evidenceCount,
    graphSupport: round(graphSupport),
    historicalSupport: round(historicalSupport),
    freshness: round(freshness),
    crossSourceAgreement: round(crossSourceAgreement),
  };
}

function computeCrossSourceAgreement(signals: SignalSnapshot[]): number {
  const sources = new Set(signals.map((signal) => signal.source));
  return Math.min(0.95, 0.45 + sources.size * 0.15);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
