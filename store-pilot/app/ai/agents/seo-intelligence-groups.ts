import type { SeoIntelligenceGroup } from "../schemas/seo-intelligence";
import {
  assignSeoRecommendationGroup,
  buildSeoRecommendationGroups,
} from "../tools/seo-group-tool";
import { hasSeoDeterministicImpact } from "../tools/seo-impact-tool";

export function assignSeoRecommendationGroupFromImpact(input: {
  category: string;
  priorityScore: number;
  impact: {
    trafficGain?: number | null;
    revenueGain?: number | null;
    visibilityLift?: number | null;
    ctrLift?: number | null;
    indexabilityImprovement?: number | null;
  };
}): SeoIntelligenceGroup {
  return assignSeoRecommendationGroup({
    category: input.category,
    priorityScore: input.priorityScore,
    hasDeterministicImpact: hasSeoDeterministicImpact(input.impact),
  });
}

export { buildSeoRecommendationGroups };
