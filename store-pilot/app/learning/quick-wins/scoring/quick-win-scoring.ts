import type { QuickWinCandidate, ScoredQuickWin } from "../shared/types";
import { estimateRevenueOpportunity } from "../impact/impact-estimator";

export function scoreQuickWinCandidate(
  candidate: QuickWinCandidate,
  averageOrderValue: number,
): ScoredQuickWin {
  const confidence = clamp(candidate.avgConfidence, 0.35, 0.99);
  const businessImpact = computeBusinessImpact(candidate);
  const urgency = computeUrgency(candidate);
  const revenueOpportunity = estimateRevenueOpportunity(candidate, averageOrderValue);
  const rankScore = computeRankScore({
    businessImpact,
    confidence,
    revenueOpportunity,
    urgency,
    effort: candidate.effort,
  });

  return {
    ...candidate,
    businessImpact,
    estimatedEffort: candidate.effort,
    confidence,
    revenueOpportunity,
    urgency,
    rankScore,
  };
}

function computeBusinessImpact(candidate: QuickWinCandidate): number {
  const countFactor = Math.min(100, Math.log10(candidate.affectedCount + 1) * 35);
  const weighted = countFactor * candidate.impactWeight;
  return Math.round(clamp(weighted, 10, 100));
}

function computeUrgency(candidate: QuickWinCandidate): number {
  const countBoost = Math.min(40, candidate.affectedCount * 2);
  return Math.round(clamp(candidate.urgencyBoost + countBoost, 5, 100));
}

function computeRankScore(input: {
  businessImpact: number;
  confidence: number;
  revenueOpportunity: number;
  urgency: number;
  effort: number;
}): number {
  const effortPenalty = (input.effort - 1) * 8;
  const revenueFactor = Math.min(30, input.revenueOpportunity / 50);

  return roundScore(
    input.businessImpact * 0.35 +
      input.urgency * 0.25 +
      input.confidence * 100 * 0.2 +
      revenueFactor * 0.15 -
      effortPenalty * 0.05,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreQuickWinCandidates(
  candidates: QuickWinCandidate[],
  averageOrderValue: number,
): ScoredQuickWin[] {
  return candidates.map((candidate) =>
    scoreQuickWinCandidate(candidate, averageOrderValue),
  );
}
