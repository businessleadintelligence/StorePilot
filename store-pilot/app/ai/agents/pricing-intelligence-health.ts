import type { PricingIntelligenceFacts } from "../facts/pricing-intelligence-facts";
import type { PricingHealthExplanation } from "../schemas/pricing-intelligence";
import { buildPricingHealthExplanation } from "../facts/pricing-intelligence-facts";

export function buildPricingIntelligenceHealthExplanation(
  facts: PricingIntelligenceFacts,
): PricingHealthExplanation {
  return buildPricingHealthExplanation({
    pricingHealthScore: facts.pricingHealthScore,
    scores: facts.scores,
    criticalIssueCount: facts.criticalIssueCount,
  });
}
