export {
  assignTrendRecommendationGroup,
  buildTrendRecommendationGroups,
} from "../tools/trend-group-tool";

import type { TrendEstimatedImpact } from "../schemas/trend-intelligence";
import { assignTrendRecommendationGroup } from "../tools/trend-group-tool";
import { hasTrendDeterministicImpact } from "../tools/trend-impact-tool";

export function assignTrendRecommendationGroupFromImpact(input: {
  category: string;
  priorityScore: number;
  impact: TrendEstimatedImpact;
}) {
  return assignTrendRecommendationGroup({
    category: input.category,
    priorityScore: input.priorityScore,
    hasDeterministicImpact: hasTrendDeterministicImpact(input.impact),
  });
}
