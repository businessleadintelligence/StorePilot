import { getUsageSummary } from "../services/entitlements.server";
import { resolveStoreCommercialPlan } from "./billing-entitlements";
import { evaluateAllBillingLimits } from "./billing-engine";
import { buildBillingNotifications } from "./billing-notifications";
import {
  comparePlanRank,
  listCanonicalPlans,
  resolveDowngradeTarget,
  resolveUpgradeTarget,
} from "./billing-limits";
import { getBillingUsageSnapshot } from "./billing-usage";
import { BILLING_CONFIG } from "./plan-config";
import type { BillingDashboardData } from "./billing-types";

export async function buildBillingDashboard(storeId: string): Promise<BillingDashboardData> {
  const startedAt = Date.now();
  const [commercial, usageChecks, usageSnapshot, entitlementUsage] = await Promise.all([
    resolveStoreCommercialPlan(storeId),
    evaluateAllBillingLimits(storeId),
    getBillingUsageSnapshot(storeId),
    getUsageSummary(storeId),
  ]);

  if (entitlementUsage) {
    usageSnapshot.aiExecutions = entitlementUsage.sharedAiCredits.used;
  }

  const plans = listCanonicalPlans();
  const upgradeTarget = resolveUpgradeTarget(commercial.plan.slug);
  const downgradeTarget = resolveDowngradeTarget(commercial.plan.slug);

  const notifications = buildBillingNotifications({
    trial: commercial.trial,
    usageChecks,
    commercialStatus: commercial.commercialStatus,
    currentPlan: commercial.plan,
  });

  const upgradeRecommendations: string[] = [];
  if (commercial.plan.slug === "starter") {
    upgradeRecommendations.push(
      `Upgrade to Growth ($${BILLING_CONFIG.plans.growth.price}/month) for full AI and all connectors.`,
    );
  }
  if (commercial.plan.slug === "growth") {
    upgradeRecommendations.push(
      `Upgrade to Pro ($${BILLING_CONFIG.plans.pro.price}/month) for faster sync and multi-store analytics.`,
    );
  }
  if (commercial.plan.slug === "pro") {
    upgradeRecommendations.push(
      `Upgrade to Agency ($${BILLING_CONFIG.plans.agency.price}/month) for multi-client management.`,
    );
  }

  return {
    storeId,
    computedAt: new Date().toISOString(),
    aggregationDurationMs: Date.now() - startedAt,
    currentPlan: commercial.plan,
    commercialStatus: commercial.commercialStatus,
    trial: commercial.trial,
    usage: usageSnapshot,
    limits: commercial.plan,
    usageChecks,
    notifications,
    upgradeRecommendations,
    plans,
    canUpgrade: upgradeTarget !== null,
    canDowngrade: downgradeTarget !== null && commercial.commercialStatus === "active",
    canCancel: commercial.commercialStatus === "active" || commercial.commercialStatus === "trialing",
    historyPlaceholder: true,
    invoicesPlaceholder: true,
  };
}

export function serializeBillingDashboardForLoader(
  dashboard: BillingDashboardData,
): BillingDashboardData {
  return JSON.parse(JSON.stringify(dashboard)) as BillingDashboardData;
}

export function isPlanUpgrade(fromSlug: string, toSlug: string): boolean {
  return comparePlanRank(fromSlug as never, toSlug as never) < 0;
}
