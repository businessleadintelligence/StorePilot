import type { GrowthIntelligenceFacts } from "../facts/growth-intelligence-facts";
import type {
  GrowthEstimatedImpact,
  GrowthIntelligenceRecommendationDraft,
} from "../schemas/growth-intelligence";
import { estimateGrowthImpact } from "../tools/growth-impact-tool";
import { sectionScoreForCategory } from "./growth-intelligence-evidence";

export function estimateGrowthRecommendationImpactForFacts(
  facts: GrowthIntelligenceFacts,
  recommendation: GrowthIntelligenceRecommendationDraft,
): GrowthEstimatedImpact {
  return estimateGrowthImpact({
    category: recommendation.category,
    confidence: recommendation.confidence,
    sectionScore: sectionScoreForCategory(facts, recommendation.category),
  });
}
