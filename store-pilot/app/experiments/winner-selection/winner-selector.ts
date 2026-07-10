import type { ExperimentComparisonResult, ExperimentWinnerRecord } from "../shared/types";

const TIE_THRESHOLD_PCT = 1.5;

export function compareExperimentResults(
  comparisons: ExperimentComparisonResult[],
): ExperimentComparisonResult[] {
  return comparisons.sort((a, b) => b.differencePct - a.differencePct);
}

export function selectExperimentWinner(
  comparisons: ExperimentComparisonResult[],
): ExperimentWinnerRecord | null {
  if (comparisons.length === 0) {
    return null;
  }

  const ranked = compareExperimentResults(comparisons);
  const best = ranked[0]!;
  const second = ranked[1];

  if (Math.abs(best.differencePct) < TIE_THRESHOLD_PCT) {
    return {
      variantKey: best.variantKey,
      outcome: "no_change",
      confidence: best.confidence,
      revenueImpact: 0,
      profitImpact: 0,
    };
  }

  if (second && Math.abs(best.differencePct - second.differencePct) < TIE_THRESHOLD_PCT) {
    return {
      variantKey: best.variantKey,
      outcome: "statistical_tie",
      confidence: Math.min(best.confidence, second.confidence),
      revenueImpact: roundCurrency((best.difference + (second?.difference ?? 0)) / 2),
      profitImpact: roundCurrency(((best.difference + (second?.difference ?? 0)) / 2) * 0.35),
    };
  }

  return {
    variantKey: best.variantKey,
    outcome: best.differencePct > 0 ? "winner" : "loser",
    confidence: best.confidence,
    revenueImpact: roundCurrency(Math.abs(best.difference)),
    profitImpact: roundCurrency(Math.abs(best.difference) * 0.35),
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
