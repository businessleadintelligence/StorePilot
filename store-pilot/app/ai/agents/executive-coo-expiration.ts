import type { ExecutiveCooFacts } from "../facts/executive-coo-facts";

export function shouldExpireExecutiveCooPriority(input: {
  facts: ExecutiveCooFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (!["open", "viewed", "snoozed"].includes(input.status)) {
    return false;
  }

  const focusArea = String(input.payload.focusArea ?? input.payload.category ?? "");
  if (focusArea === "Inventory" && input.facts.inventoryRisk < 20) {
    return true;
  }

  if (focusArea === "Revenue" && input.facts.revenueOpportunity <= 0) {
    return true;
  }

  if (input.facts.operationsHealthScore >= 90 && input.facts.criticalIssueCount === 0) {
    return String(input.payload.priority ?? 3) !== "1";
  }

  return false;
}

export function getExecutiveCooPriorityExpirationReason(input: {
  facts: ExecutiveCooFacts;
  payload: Record<string, unknown>;
}): string | null {
  const focusArea = String(input.payload.focusArea ?? input.payload.category ?? "");

  if (focusArea === "Inventory" && input.facts.inventoryRisk < 20) {
    return "inventory_risk_resolved";
  }

  if (focusArea === "Revenue" && input.facts.revenueOpportunity <= 0) {
    return "revenue_opportunity_closed";
  }

  if (input.facts.operationsHealthScore >= 90) {
    return "operations_stabilized";
  }

  return null;
}

export function getExecutiveCooPriorityVerificationReason(input: {
  facts: ExecutiveCooFacts;
  payload: Record<string, unknown>;
}): string | null {
  const focusArea = String(input.payload.focusArea ?? input.payload.category ?? "");

  if (focusArea === "Inventory" && input.facts.inventoryRisk < 30) {
    return "inventory_metrics_improved";
  }

  if (focusArea === "Revenue" && input.facts.revenueOpportunity > 0) {
    return "revenue_metrics_improved";
  }

  if (input.facts.operationsHealthScore >= 75) {
    return "operations_health_improved";
  }

  return null;
}

export const getExecutiveCooRecommendationExpirationReason = getExecutiveCooPriorityExpirationReason;
export const getExecutiveCooRecommendationVerificationReason = getExecutiveCooPriorityVerificationReason;
export const shouldExpireGrowthRecommendation = shouldExpireExecutiveCooPriority;
