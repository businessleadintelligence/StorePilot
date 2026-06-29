import type { GrowthIntelligenceFacts } from "../facts/growth-intelligence-facts";
import type { GrowthHealthExplanation } from "../schemas/growth-intelligence";
import { buildGrowthHealthExplanation } from "../facts/growth-intelligence-facts";

export function buildGrowthIntelligenceHealthExplanation(
  facts: GrowthIntelligenceFacts,
): GrowthHealthExplanation {
  return buildGrowthHealthExplanation({
    growthHealthScore: facts.growthHealthScore,
    scores: facts.scores,
    criticalIssueCount: facts.criticalIssueCount,
  });
}
