import { resolveStoreCommercialPlan } from "./billing-entitlements";
import { evaluateAllBillingLimits } from "./billing-engine";
import type { BillingDashboardData } from "./billing-types";

export async function evaluateBillingHealth(storeId: string): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const [{ commercialStatus }, usageChecks] = await Promise.all([
    resolveStoreCommercialPlan(storeId),
    evaluateAllBillingLimits(storeId),
  ]);

  const issues: string[] = [];

  if (commercialStatus === "past_due" || commercialStatus === "expired") {
    issues.push(`subscription_${commercialStatus}`);
  }

  for (const check of Object.values(usageChecks)) {
    if (!check.allowed && check.reason === "limit_exceeded") {
      issues.push(`limit:${check.action}`);
    }
  }

  return { healthy: issues.length === 0, issues };
}

export type BillingHealthSummary = Awaited<ReturnType<typeof evaluateBillingHealth>>;

export function billingHealthLabel(healthy: boolean): "Healthy" | "Needs Attention" | "Critical" {
  return healthy ? "Healthy" : "Needs Attention";
}

export function buildBillingDashboardHealthSection(dashboard: BillingDashboardData): {
  label: string;
  blockedActions: string[];
} {
  const blockedActions = Object.values(dashboard.usageChecks)
    .filter((check) => !check.allowed)
    .map((check) => check.action);

  return {
    label:
      dashboard.commercialStatus === "active" || dashboard.commercialStatus === "trialing"
        ? blockedActions.length > 0
          ? "Needs Attention"
          : "Healthy"
        : "Critical",
    blockedActions,
  };
}
