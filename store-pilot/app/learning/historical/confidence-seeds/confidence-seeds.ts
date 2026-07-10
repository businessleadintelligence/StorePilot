import type {
  ConfidenceSeedRecord,
  HistoricalAggregationSnapshot,
} from "../shared/types";
import { CONFIDENCE_DOMAIN_MAP } from "../shared/types";

export function buildConfidenceSeeds(input: {
  snapshot: HistoricalAggregationSnapshot;
  graphNodeCount: number;
  graphEdgeCount: number;
  evidenceCount: number;
  bootstrapConfidences?: Record<string, number>;
}): ConfidenceSeedRecord[] {
  const graphCoverage = input.graphNodeCount > 0 ? Math.min(1, input.graphEdgeCount / (input.graphNodeCount * 2)) : 0;
  const evidenceCoverage =
    input.evidenceCount > 0
      ? Math.min(1, Object.keys(input.snapshot.evidenceByFactType).length / 20)
      : 0;

  return Object.entries(CONFIDENCE_DOMAIN_MAP).map(([domain, factTypes]) => {
    const observedFacts = factTypes.filter(
      (factType) => (input.snapshot.evidenceByFactType[factType] ?? 0) > 0,
    ).length;
    const factCoverage = factTypes.length > 0 ? observedFacts / factTypes.length : 0;
    const baselinePercent = input.bootstrapConfidences?.[domain] ?? 40;
    const historicalBoost = Math.round(factCoverage * 25 + evidenceCoverage * 15 + graphCoverage * 10);
    const confidencePercent = Math.min(98, baselinePercent + historicalBoost);

    return {
      domain,
      confidencePercent,
      baselinePercent,
      evidenceCoverage: round(evidenceCoverage),
      graphCoverage: round(graphCoverage),
    };
  });
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function computeOverallConfidenceFromSeeds(
  seeds: ConfidenceSeedRecord[],
): number {
  if (seeds.length === 0) {
    return 0;
  }
  const weighted =
    seeds.reduce((sum, seed) => sum + seed.confidencePercent, 0) / seeds.length;
  return Math.round(weighted);
}
