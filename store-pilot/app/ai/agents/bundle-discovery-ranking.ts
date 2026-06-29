import type { BundleFacts } from "../facts/bundle-facts";
import type {
  BundleEstimatedImpact,
  BundleIntelligenceCategory,
  BundleIntelligenceRecommendationDraft,
} from "../schemas/bundle-intelligence";
import { hasBundleDeterministicImpact } from "./bundle-discovery-impact";

export type BundleMerchantPreferenceProfile = {
  dismissedCategories: Set<BundleIntelligenceCategory>;
  snoozedCategories: Set<BundleIntelligenceCategory>;
  ignoredCategories: Set<BundleIntelligenceCategory>;
  implementedCategories: Set<BundleIntelligenceCategory>;
};

export type RankedBundleRecommendationDraft = BundleIntelligenceRecommendationDraft & {
  priorityScore: number;
};

const DIFFICULTY_WEIGHT: Record<BundleIntelligenceRecommendationDraft["estimatedDifficulty"], number> =
  {
    Easy: 1,
    Medium: 0.75,
    Hard: 0.5,
  };

export function buildBundleMerchantPreferenceProfile(
  records: Array<{
    category: string;
    status: string;
    payloadJson: Record<string, unknown>;
  }>,
): BundleMerchantPreferenceProfile {
  const dismissedCategories = new Set<BundleIntelligenceCategory>();
  const snoozedCategories = new Set<BundleIntelligenceCategory>();
  const ignoredCategories = new Set<BundleIntelligenceCategory>();
  const implementedCategories = new Set<BundleIntelligenceCategory>();

  for (const record of records) {
    const category = record.category as BundleIntelligenceCategory;
    const feedback = String(record.payloadJson.feedback ?? record.status).toLowerCase();

    if (feedback === "snoozed" || record.payloadJson.snoozedUntil) {
      snoozedCategories.add(category);
    }

    if (feedback === "ignored") {
      ignoredCategories.add(category);
    }

    if (record.status === "dismissed") {
      dismissedCategories.add(category);
    }

    if (record.status === "implemented" || record.status === "verified") {
      implementedCategories.add(category);
    }
  }

  return {
    dismissedCategories,
    snoozedCategories,
    ignoredCategories,
    implementedCategories,
  };
}

function bundleImpactScore(impact: BundleEstimatedImpact): number {
  return (
    (impact.attachRateLift ?? 0) * 100 +
    (impact.inventoryUnitsReduced ?? 0) / 2 +
    (impact.bundleOrdersExpected ?? 0) * 2 +
    (impact.estimatedBundleValue ?? 0) / 50
  );
}

export function calculateBundleRecommendationPriorityScore(input: {
  facts: BundleFacts;
  recommendation: BundleIntelligenceRecommendationDraft;
  impact: BundleEstimatedImpact;
  preferences?: BundleMerchantPreferenceProfile;
}): number {
  let score = input.recommendation.confidence * 100;
  score += bundleImpactScore(input.impact);
  score *= DIFFICULTY_WEIGHT[input.recommendation.estimatedDifficulty];

  const candidate = input.facts.bundleCandidates.find((item) => item.id === input.recommendation.id);
  if (candidate) {
    score += candidate.priorityScore * 0.25;
  }

  if (input.recommendation.category === "Dead Inventory Bundle") {
    score += input.facts.deadInventoryPairCount * 3;
  }

  if (input.preferences?.dismissedCategories.has(input.recommendation.category)) {
    score -= 15;
  }

  if (input.preferences?.ignoredCategories.has(input.recommendation.category)) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankBundleRecommendations(input: {
  facts: BundleFacts;
  recommendations: BundleIntelligenceRecommendationDraft[];
  impacts: Map<string, BundleEstimatedImpact>;
  preferences?: BundleMerchantPreferenceProfile;
}): RankedBundleRecommendationDraft[] {
  return [...input.recommendations]
    .map((recommendation) => ({
      ...recommendation,
      priorityScore: calculateBundleRecommendationPriorityScore({
        facts: input.facts,
        recommendation,
        impact: input.impacts.get(recommendation.id) ?? {},
        preferences: input.preferences,
      }),
    }))
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        left.estimatedDifficulty.localeCompare(right.estimatedDifficulty),
    );
}

export function deriveBundleOverallPriority(
  recommendations: RankedBundleRecommendationDraft[],
): number {
  if (recommendations.length === 0) {
    return 3;
  }

  const top = recommendations[0]?.priorityScore ?? 0;
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

export function deriveBundleOverallConfidence(
  recommendations: RankedBundleRecommendationDraft[],
): number {
  if (recommendations.length === 0) {
    return 0;
  }

  const total = recommendations.reduce((sum, item) => sum + item.confidence, 0);
  return Math.round((total / recommendations.length) * 100) / 100;
}

export function hasBundleDeterministicImpactForRanking(impact: BundleEstimatedImpact): boolean {
  return hasBundleDeterministicImpact(impact);
}
