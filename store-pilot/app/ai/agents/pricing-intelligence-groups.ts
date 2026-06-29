export {
  assignPricingRecommendationGroup,
  buildPricingRecommendationGroups,
} from "../tools/pricing-group-tool";

import type { PricingEstimatedImpact } from "../schemas/pricing-intelligence";
import { assignPricingRecommendationGroup } from "../tools/pricing-group-tool";
import { hasPricingDeterministicImpact } from "../tools/pricing-impact-tool";

export function assignPricingRecommendationGroupFromImpact(input: {
  category: string;
  priorityScore: number;
  impact: PricingEstimatedImpact;
}) {
  return assignPricingRecommendationGroup({
    category: input.category,
    priorityScore: input.priorityScore,
    hasDeterministicImpact: hasPricingDeterministicImpact(input.impact),
  });
}
