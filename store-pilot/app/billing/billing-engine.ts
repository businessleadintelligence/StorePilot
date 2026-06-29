import { checkUsageLimit } from "../services/entitlements.server";
import { getSubscriptionAccessState } from "../services/subscription.server";
import {
  isCommercialAccessAllowed,
  isFeatureEnabled,
  resolveStoreCommercialPlan,
} from "./billing-entitlements";
import { buildUpgradeMessage, getPlanLimit } from "./billing-limits";
import { getBillingUsageSnapshot, getUsageValueForAction } from "./billing-usage";
import type { BillingAction, BillingLimitCheckResult } from "./billing-types";

export async function enforceBillingAction(
  storeId: string,
  action: BillingAction,
  increment = 1,
): Promise<BillingLimitCheckResult> {
  const { plan, commercialStatus } = await resolveStoreCommercialPlan(storeId);

  if (!isCommercialAccessAllowed(commercialStatus)) {
    return {
      allowed: false,
      action,
      used: 0,
      limit: getPlanLimit(plan, action),
      remaining: 0,
      upgradeMessage: "Your subscription is inactive. Select a plan to continue.",
      reason: commercialStatus,
    };
  }

  if (action === "operations_create" && !isFeatureEnabled(plan, "operations")) {
    return blockedFeature(action, plan.slug, "Operations Center requires Growth plan or higher.");
  }

  if (
    (action === "automation_create" || action === "automation_execute") &&
    !isFeatureEnabled(plan, "automation")
  ) {
    return blockedFeature(action, plan.slug, "Automation Center requires Growth plan or higher.");
  }

  if (action === "ai_execution") {
    const aiCheck = await checkUsageLimit(storeId, "ai_requests", increment);
    if (!aiCheck.allowed) {
      return {
        allowed: false,
        action,
        used: aiCheck.used,
        limit: aiCheck.limit,
        remaining: aiCheck.remaining,
        upgradeMessage: buildUpgradeMessage(plan.slug, action),
        reason: aiCheck.reason,
      };
    }
  }

  const usage = await getBillingUsageSnapshot(storeId);
  const used = getUsageValueForAction(usage, action);
  const limit = getPlanLimit(plan, action);
  const projected = used + Math.max(0, Math.floor(increment));

  if (projected > limit) {
    return {
      allowed: false,
      action,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      upgradeMessage: buildUpgradeMessage(plan.slug, action),
      reason: "limit_exceeded",
    };
  }

  return {
    allowed: true,
    action,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    upgradeMessage: null,
    reason: null,
  };
}

export async function assertBillingActionAllowed(
  storeId: string,
  action: BillingAction,
  increment = 1,
): Promise<BillingLimitCheckResult> {
  const result = await enforceBillingAction(storeId, action, increment);
  if (!result.allowed) {
    throw new BillingEnforcementError(result);
  }
  return result;
}

export class BillingEnforcementError extends Error {
  readonly result: BillingLimitCheckResult;

  constructor(result: BillingLimitCheckResult) {
    super(result.upgradeMessage ?? "Billing limit exceeded");
    this.name = "BillingEnforcementError";
    this.result = result;
  }
}

function blockedFeature(
  action: BillingAction,
  planSlug: BillingLimitCheckResult["action"] extends never ? never : import("./billing-types").BillingPlanSlug,
  message: string,
): BillingLimitCheckResult {
  return {
    allowed: false,
    action,
    used: 0,
    limit: 0,
    remaining: 0,
    upgradeMessage: message,
    reason: "feature_locked",
  };
}

export async function evaluateAllBillingLimits(
  storeId: string,
): Promise<Record<BillingAction, BillingLimitCheckResult>> {
  const actions: BillingAction[] = [
    "ai_execution",
    "automation_create",
    "automation_execute",
    "connector_sync",
    "operations_create",
    "api_request",
    "background_job",
    "data_export",
  ];

  const entries = await Promise.all(
    actions.map(async (action) => [action, await enforceBillingAction(storeId, action, 0)] as const),
  );

  return Object.fromEntries(entries) as Record<BillingAction, BillingLimitCheckResult>;
}

export async function canAccessBillingProtectedFeature(
  storeId: string,
  feature: "operations" | "automation" | "advanced_coo",
): Promise<{ allowed: boolean; upgradeMessage: string | null }> {
  const access = await getSubscriptionAccessState(storeId);
  if (access.accessState !== "allowed") {
    return { allowed: false, upgradeMessage: "Activate a subscription to use this feature." };
  }

  const { plan } = await resolveStoreCommercialPlan(storeId);
  const allowed = isFeatureEnabled(plan, feature);
  return {
    allowed,
    upgradeMessage: allowed ? null : `${feature} requires a higher plan. Upgrade from Billing.`,
  };
}
