import { getUsageSummary } from "../services/entitlements.server";
import { resolveStoreCommercialPlan, isLegacyFeatureEnabled } from "./billing-entitlements";
import { evaluateAllBillingLimits } from "./billing-engine";
import { buildBillingNotifications } from "./billing-notifications";
import {
  listCanonicalPlans,
  resolveDowngradeTarget,
  resolveUpgradeTarget,
  buildUpgradeRecommendation,
} from "./billing-limits";
import { getBillingUsageSnapshot } from "./billing-usage";
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
    usageSnapshot.products = entitlementUsage.products.used;
    usageSnapshot.reports = entitlementUsage.reports_generated.used;
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
  const recommendation = buildUpgradeRecommendation(commercial.plan.slug);
  if (recommendation) {
    upgradeRecommendations.push(recommendation);
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
    workerQueueTier: commercial.plan.workerQueueTier,
  };
}

export function serializeBillingDashboardForLoader(
  dashboard: BillingDashboardData,
): BillingDashboardData {
  return JSON.parse(JSON.stringify(dashboard)) as BillingDashboardData;
}

export { isLegacyFeatureEnabled as isFeatureEnabledForLegacyUi };
