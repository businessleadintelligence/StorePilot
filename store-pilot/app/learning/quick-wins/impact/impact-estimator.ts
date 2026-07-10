import {
  DEFAULT_AOV_FALLBACK,
  REVENUE_OPPORTUNITY_MULTIPLIERS,
} from "../shared/constants";
import type { QuickWinCandidate } from "../shared/types";

export function estimateAverageOrderValue(baselineJson: unknown): number {
  if (!baselineJson || typeof baselineJson !== "object") {
    return DEFAULT_AOV_FALLBACK;
  }

  const record = baselineJson as Record<string, unknown>;
  const aov = record.averageOrderValue;
  if (typeof aov === "number" && aov > 0) {
    return aov;
  }

  return DEFAULT_AOV_FALLBACK;
}

export function estimateRevenueOpportunity(
  candidate: QuickWinCandidate,
  averageOrderValue: number,
): number {
  const categoryMultiplier =
    REVENUE_OPPORTUNITY_MULTIPLIERS[candidate.category] ?? 0.5;

  const perItemOpportunity = averageOrderValue * 0.08 * categoryMultiplier;
  const raw = candidate.affectedCount * perItemOpportunity * candidate.impactWeight;

  return roundCurrency(Math.min(raw, averageOrderValue * candidate.affectedCount * 2));
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumRevenueOpportunity(wins: Array<{ revenueOpportunity: number }>): number {
  return roundCurrency(wins.reduce((sum, win) => sum + win.revenueOpportunity, 0));
}
