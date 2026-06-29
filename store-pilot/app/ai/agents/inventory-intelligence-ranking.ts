import type { InventoryFacts } from "../facts/inventory-facts";
import type {
  InventoryEstimatedImpact,
  InventoryIntelligenceCategory,
  InventoryIntelligenceRecommendationDraft,
} from "../schemas/inventory-intelligence";
import { hasInventoryDeterministicImpact } from "./inventory-intelligence-impact";

export type InventoryMerchantPreferenceProfile = {
  dismissedCategories: Set<InventoryIntelligenceCategory>;
  snoozedCategories: Set<InventoryIntelligenceCategory>;
  ignoredCategories: Set<InventoryIntelligenceCategory>;
  implementedCategories: Set<InventoryIntelligenceCategory>;
};

export type RankedInventoryRecommendationDraft = InventoryIntelligenceRecommendationDraft & {
  priorityScore: number;
};

const DIFFICULTY_WEIGHT: Record<InventoryIntelligenceRecommendationDraft["estimatedDifficulty"], number> =
  {
    Easy: 1,
    Medium: 0.75,
    Hard: 0.5,
  };

export function buildInventoryMerchantPreferenceProfile(
  records: Array<{
    category: string;
    status: string;
    payloadJson: Record<string, unknown>;
  }>,
): InventoryMerchantPreferenceProfile {
  const dismissedCategories = new Set<InventoryIntelligenceCategory>();
  const snoozedCategories = new Set<InventoryIntelligenceCategory>();
  const ignoredCategories = new Set<InventoryIntelligenceCategory>();
  const implementedCategories = new Set<InventoryIntelligenceCategory>();

  for (const record of records) {
    const category = record.category as InventoryIntelligenceCategory;
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

function inventoryImpactScore(impact: InventoryEstimatedImpact): number {
  return (
    (impact.ordersProtected ?? 0) * 4 +
    (impact.inventoryCostSaved ?? 0) / 25 +
    (impact.inventoryDaysSaved ?? 0) * 2 +
    (impact.unitsRecovered ?? 0)
  );
}

export function calculateInventoryPriorityScore(input: {
  facts: InventoryFacts;
  recommendation: InventoryIntelligenceRecommendationDraft;
  impact: InventoryEstimatedImpact;
  preferences?: InventoryMerchantPreferenceProfile;
}): number {
  let score = input.recommendation.confidence * 100;
  score += inventoryImpactScore(input.impact);
  score *= DIFFICULTY_WEIGHT[input.recommendation.estimatedDifficulty];

  if (input.recommendation.category === "Stockout" || input.recommendation.category === "Reorder") {
    score += input.facts.stockoutAlertCount * 3;
  }

  if (input.recommendation.category === "Dead Inventory") {
    score += input.facts.deadStockCount * 2;
  }

  if (input.preferences?.dismissedCategories.has(input.recommendation.category)) {
    score -= 15;
  }

  if (input.preferences?.ignoredCategories.has(input.recommendation.category)) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankInventoryRecommendations(input: {
  facts: InventoryFacts;
  recommendations: InventoryIntelligenceRecommendationDraft[];
  impacts: Map<string, InventoryEstimatedImpact>;
  preferences?: InventoryMerchantPreferenceProfile;
}): RankedInventoryRecommendationDraft[] {
  return [...input.recommendations]
    .map((recommendation) => ({
      ...recommendation,
      priorityScore: calculateInventoryPriorityScore({
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

export function deriveInventoryOverallPriority(
  recommendations: RankedInventoryRecommendationDraft[],
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

export function deriveInventoryOverallConfidence(
  recommendations: RankedInventoryRecommendationDraft[],
): number {
  if (recommendations.length === 0) {
    return 0;
  }

  const total = recommendations.reduce((sum, item) => sum + item.confidence, 0);
  return Math.round((total / recommendations.length) * 100) / 100;
}

export function hasInventoryDeterministicImpactForRanking(impact: InventoryEstimatedImpact): boolean {
  return hasInventoryDeterministicImpact(impact);
}
