import type { BundleEstimatedImpact } from "../schemas/bundle-intelligence";

export type RankedBundleCandidate = {
  id: string;
  confidence: number;
  attachRate: number;
  priorityScore: number;
};

export function calculateBundlePriorityScore(input: {
  confidence: number;
  attachRate: number;
  impact: BundleEstimatedImpact;
  complexity: "simple" | "moderate" | "complex";
}): number {
  let score = input.confidence * 100 + input.attachRate * 40;
  score += (input.impact.attachRateLift ?? 0) * 50;
  score += (input.impact.inventoryUnitsReduced ?? 0) / 2;
  score += (input.impact.bundleOrdersExpected ?? 0);

  if (input.complexity === "simple") {
    score += 8;
  } else if (input.complexity === "complex") {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankBundleCandidates<T extends RankedBundleCandidate>(candidates: T[]): T[] {
  return [...candidates].sort(
    (left, right) => right.priorityScore - left.priorityScore || right.confidence - left.confidence,
  );
}

export function deriveBundleOverallPriority(candidates: RankedBundleCandidate[]): number {
  if (candidates.length === 0) {
    return 3;
  }

  const top = candidates[0]?.priorityScore ?? 0;
  if (top >= 85) {
    return 1;
  }

  if (top >= 70) {
    return 2;
  }

  if (top >= 50) {
    return 3;
  }

  return 4;
}

export function deriveBundleOverallConfidence(candidates: RankedBundleCandidate[]): number {
  if (candidates.length === 0) {
    return 0;
  }

  const total = candidates.reduce((sum, item) => sum + item.confidence, 0);
  return Math.round((total / candidates.length) * 100) / 100;
}
