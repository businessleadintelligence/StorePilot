import type { StoreAuditIntelligenceGroup } from "../schemas/store-audit-intelligence";
import {
  assignStoreAuditRecommendationGroup,
  buildStoreAuditRecommendationGroups,
} from "../tools/audit-group-tool";
import { hasAuditDeterministicImpact } from "../tools/audit-impact-tool";

export function assignStoreAuditRecommendationGroupForDraft(input: {
  category: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
}): StoreAuditIntelligenceGroup {
  return assignStoreAuditRecommendationGroup(input);
}

export function assignStoreAuditRecommendationGroupFromImpact(input: {
  category: string;
  priorityScore: number;
  impact: {
    conversionLift?: number | null;
    seoLift?: number | null;
    performanceGain?: number | null;
    accessibilityImprovement?: number | null;
  };
}): StoreAuditIntelligenceGroup {
  return assignStoreAuditRecommendationGroup({
    category: input.category,
    priorityScore: input.priorityScore,
    hasDeterministicImpact: hasAuditDeterministicImpact(input.impact),
  });
}

export { buildStoreAuditRecommendationGroups };
