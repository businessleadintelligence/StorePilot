import type { ProductFacts } from "../facts/product-facts";
import type {
  EstimatedImpact,
  ProductIntelligenceCategory,
  ProductIntelligenceRecommendationDraft,
} from "../schemas/product-intelligence";
import { hasDeterministicImpact } from "./product-intelligence-impact";

export type MerchantPreferenceProfile = {
  dismissedCategories: Set<ProductIntelligenceCategory>;
  snoozedCategories: Set<ProductIntelligenceCategory>;
  ignoredCategories: Set<ProductIntelligenceCategory>;
  implementedCategories: Set<ProductIntelligenceCategory>;
};

export type RankedRecommendationDraft = ProductIntelligenceRecommendationDraft & {
  priorityScore: number;
};

const DIFFICULTY_WEIGHT: Record<ProductIntelligenceRecommendationDraft["difficulty"], number> = {
  Easy: 1,
  Medium: 0.75,
  Hard: 0.5,
};

const STOCK_RISK_WEIGHT: Record<ProductFacts["stockRisk"], number> = {
  CRITICAL: 1,
  HIGH: 0.85,
  MEDIUM: 0.55,
  LOW: 0.25,
  UNKNOWN: 0.35,
};

export function buildMerchantPreferenceProfile(
  records: Array<{
    category: string;
    status: string;
    payloadJson: Record<string, unknown>;
  }>,
): MerchantPreferenceProfile {
  const dismissedCategories = new Set<ProductIntelligenceCategory>();
  const snoozedCategories = new Set<ProductIntelligenceCategory>();
  const ignoredCategories = new Set<ProductIntelligenceCategory>();
  const implementedCategories = new Set<ProductIntelligenceCategory>();

  for (const record of records) {
    const category = record.category as ProductIntelligenceCategory;
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

function revenueImpactScore(impact: EstimatedImpact): number {
  const values = [
    impact.revenueRecovered ?? 0,
    impact.revenueOpportunity ?? 0,
    impact.marginImprovement ?? 0,
    impact.inventoryCostSaved ?? 0,
  ];

  const maxValue = Math.max(...values);
  if (maxValue <= 0) {
    return 0.2;
  }

  return Math.min(1, maxValue / 50_000);
}

function urgencyScore(facts: ProductFacts, category: ProductIntelligenceCategory): number {
  if (category === "Inventory") {
    return STOCK_RISK_WEIGHT[facts.stockRisk];
  }

  if (facts.trend === "declining") {
    return 0.8;
  }

  if (facts.refundRate >= 5) {
    return 0.7;
  }

  return 0.35;
}

function riskScore(facts: ProductFacts, category: ProductIntelligenceCategory): number {
  if (facts.stockRisk === "CRITICAL" && category === "Inventory") {
    return 1;
  }

  if (facts.refundRate >= 8) {
    return 0.85;
  }

  if (facts.trend === "declining") {
    return 0.7;
  }

  return 0.3;
}

function preferenceScore(
  category: ProductIntelligenceCategory,
  preferences: MerchantPreferenceProfile,
): number {
  let score = 1;

  if (preferences.dismissedCategories.has(category)) {
    score -= 0.35;
  }

  if (preferences.snoozedCategories.has(category)) {
    score -= 0.25;
  }

  if (preferences.ignoredCategories.has(category)) {
    score -= 0.15;
  }

  if (preferences.implementedCategories.has(category)) {
    score += 0.05;
  }

  return Math.max(0.1, Math.min(1, score));
}

export function calculatePriorityScore(input: {
  facts: ProductFacts;
  recommendation: ProductIntelligenceRecommendationDraft;
  impact: EstimatedImpact;
  preferences?: MerchantPreferenceProfile;
}): number {
  const { facts, recommendation, impact, preferences } = input;
  const revenue = revenueImpactScore(impact);
  const urgency = urgencyScore(facts, recommendation.category);
  const risk = riskScore(facts, recommendation.category);
  const confidence = recommendation.confidence;
  const ease = DIFFICULTY_WEIGHT[recommendation.difficulty];
  const preference = preferences
    ? preferenceScore(recommendation.category, preferences)
    : 1;

  const weighted =
    revenue * 0.28 +
    risk * 0.22 +
    urgency * 0.2 +
    confidence * 0.15 +
    ease * 0.1 +
    preference * 0.05;

  return Math.round(Math.max(0, Math.min(100, weighted * 100)));
}

export function rankRecommendations(input: {
  facts: ProductFacts;
  recommendations: ProductIntelligenceRecommendationDraft[];
  impacts: Map<string, EstimatedImpact>;
  preferences?: MerchantPreferenceProfile;
}): RankedRecommendationDraft[] {
  return input.recommendations
    .map((recommendation) => ({
      ...recommendation,
      priorityScore: calculatePriorityScore({
        facts: input.facts,
        recommendation,
        impact: input.impacts.get(recommendation.id) ?? {},
        preferences: input.preferences,
      }),
    }))
    .sort((left, right) => right.priorityScore - left.priorityScore);
}

export function deriveOverallPriority(ranked: RankedRecommendationDraft[]): number {
  if (ranked.length === 0) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.ceil(ranked[0].priorityScore / 20)));
}

export function deriveOverallConfidence(ranked: RankedRecommendationDraft[]): number {
  if (ranked.length === 0) {
    return 0.5;
  }

  const total = ranked.reduce((sum, recommendation) => sum + recommendation.confidence, 0);
  return Math.round((total / ranked.length) * 100) / 100;
}

export function scoreHasMaterialImpact(impact: EstimatedImpact): boolean {
  return hasDeterministicImpact(impact);
}
