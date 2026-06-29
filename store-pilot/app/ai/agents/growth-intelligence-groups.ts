export {
  assignGrowthRecommendationGroup,
  buildGrowthRecommendationGroups,
} from "../tools/growth-group-tool";

import type { GrowthEstimatedImpact } from "../schemas/growth-intelligence";
import { assignGrowthRecommendationGroup } from "../tools/growth-group-tool";
import { hasGrowthDeterministicImpact } from "../tools/growth-impact-tool";

export function assignGrowthRecommendationGroupFromImpact(input: {
  category: string;
  priorityScore: number;
  impact: GrowthEstimatedImpact;
}) {
  return assignGrowthRecommendationGroup({
    category: input.category,
    priorityScore: input.priorityScore,
    hasDeterministicImpact: hasGrowthDeterministicImpact(input.impact),
  });
}
