import type { PricingIntelligenceFacts } from "../facts/pricing-intelligence-facts";
import type {
  PricingEstimatedImpact,
  PricingIntelligenceRecommendationDraft,
} from "../schemas/pricing-intelligence";
import { estimatePricingImpact } from "../tools/pricing-impact-tool";

function sectionScoreForCategory(facts: PricingIntelligenceFacts, category: string): number {
  const mapping: Record<string, number> = {
    "Margin Protection": facts.margin.marginPercent,
    "Discount Optimization": facts.discount.score,
    "Premium Pricing": facts.premium.score,
    "Inventory Pricing": facts.inventory.score,
    "Bundle Pricing": facts.bundle.score,
    "Psychological Pricing": facts.psychology.score,
    "Price Consistency": facts.priceConsistency.priceConsistencyScore,
    "Revenue Optimization": Math.max(0, 100 - facts.revenue.revenueRisk),
    "Conversion Pricing": facts.conversion.score,
    "Markdown Timing": facts.discount.score,
    "Competitive Pricing": facts.competition.score,
    "Loss Leader Strategy": facts.strategySignals.lossLeaderCandidates > 0 ? 55 : 85,
  };

  return mapping[category] ?? facts.pricingHealthScore;
}

export function estimatePricingRecommendationImpactForFacts(
  facts: PricingIntelligenceFacts,
  recommendation: PricingIntelligenceRecommendationDraft,
): PricingEstimatedImpact {
  return estimatePricingImpact({
    category: recommendation.category,
    confidence: recommendation.confidence,
    sectionScore: sectionScoreForCategory(facts, recommendation.category),
  });
}
