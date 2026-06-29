import {
  getCurrentMonthUsage,
  getCurrentUsageMonth,
  getSharedAiCreditsUsed,
  tryIncrementAiCreditsWithinLimit,
} from "./billing.server";
import { getStoreEntitlements, type EntitlementErrorCode } from "./entitlements.server";
import { getSubscriptionAccessState } from "./subscription.server";

export type AiCostControlErrorCode =
  | "budget_exceeded"
  | "subscription_missing"
  | "subscription_inactive"
  | "plan_missing"
  | "usage_missing";

export type AiAlertLevel =
  | "normal"
  | "warning_80"
  | "warning_90"
  | "limit_reached";

export type AiBudgetStatus = {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  percentUsed: number;
  alertLevel: AiAlertLevel;
  reason: AiCostControlErrorCode | null;
};

export type AiUsageSummary = AiBudgetStatus & {
  storeId: string;
  month: string;
  planSlug: string;
  fallbackReason: AiCostControlErrorCode | null;
};

export type ConsumeAiCreditsResult = AiBudgetStatus & {
  consumed: number;
};

function normalizeCredits(credits?: number): number {
  if (credits === undefined) {
    return 1;
  }

  if (!Number.isFinite(credits)) {
    return 0;
  }

  return Math.max(0, Math.floor(credits));
}

export function calculatePercentUsed(used: number, limit: number): number {
  const safeUsed = Math.max(0, used);
  const safeLimit = Math.max(0, limit);

  if (safeLimit === 0) {
    return safeUsed > 0 ? 100 : 0;
  }

  const percent = (safeUsed / safeLimit) * 100;

  if (!Number.isFinite(percent)) {
    return 0;
  }

  return Math.min(100, percent);
}

export function getAlertLevelForUsage(
  used: number,
  limit: number,
  percentUsed = calculatePercentUsed(used, limit),
): AiAlertLevel {
  const safeUsed = Math.max(0, used);
  const safeLimit = Math.max(0, limit);

  if (safeLimit === 0 && safeUsed > 0) {
    return "limit_reached";
  }

  if (safeUsed >= safeLimit && safeLimit > 0) {
    return "limit_reached";
  }

  if (percentUsed >= 100) {
    return "limit_reached";
  }

  if (percentUsed >= 90) {
    return "warning_90";
  }

  if (percentUsed >= 80) {
    return "warning_80";
  }

  return "normal";
}

function mapFallbackReason(
  reason: EntitlementErrorCode | null,
): AiCostControlErrorCode | null {
  if (
    reason === "subscription_missing" ||
    reason === "subscription_inactive" ||
    reason === "plan_missing" ||
    reason === "usage_missing"
  ) {
    return reason;
  }

  return null;
}

function buildBudgetStatus(input: {
  used: number;
  limit: number;
  estimatedCredits?: number;
  reason?: AiCostControlErrorCode | null;
}): AiBudgetStatus {
  const used = Math.max(0, input.used);
  const limit = Math.max(0, input.limit);
  const estimatedCredits = normalizeCredits(input.estimatedCredits);
  const remaining = Math.max(0, limit - used);
  const percentUsed = calculatePercentUsed(used, limit);
  const projected = used + estimatedCredits;

  if (input.reason) {
    return {
      allowed: false,
      used,
      remaining,
      limit,
      percentUsed,
      alertLevel: getAlertLevelForUsage(used, limit, percentUsed),
      reason: input.reason,
    };
  }

  const allowed = projected <= limit;
  const statusUsed = estimatedCredits > 0 ? projected : used;
  const statusPercent = calculatePercentUsed(statusUsed, limit);

  return {
    allowed,
    used,
    remaining,
    limit,
    percentUsed,
    alertLevel: getAlertLevelForUsage(statusUsed, limit, statusPercent),
    reason: allowed ? null : "budget_exceeded",
  };
}

function buildBlockedStatus(
  reason: AiCostControlErrorCode,
  limit = 0,
): AiBudgetStatus {
  return {
    allowed: false,
    used: 0,
    remaining: 0,
    limit,
    percentUsed: 0,
    alertLevel: reason === "plan_missing" ? "limit_reached" : "normal",
    reason,
  };
}

async function resolveAiBudget(storeId: string): Promise<{
  limit: number;
  used: number;
  reason: AiCostControlErrorCode | null;
  planSlug: string;
  fallbackReason: AiCostControlErrorCode | null;
  month: string;
}> {
  const month = getCurrentUsageMonth();

  if (!storeId) {
    return {
      limit: 0,
      used: 0,
      reason: "plan_missing",
      planSlug: "starter",
      fallbackReason: "plan_missing",
      month,
    };
  }

  const entitlements = await getStoreEntitlements(storeId);

  if (!entitlements) {
    return {
      limit: 0,
      used: 0,
      reason: "plan_missing",
      planSlug: "starter",
      fallbackReason: "plan_missing",
      month,
    };
  }

  if (entitlements.fallbackReason === "plan_missing") {
    return {
      limit: 0,
      used: 0,
      reason: "plan_missing",
      planSlug: entitlements.planSlug,
      fallbackReason: "plan_missing",
      month,
    };
  }

  const subscriptionAccess = await getSubscriptionAccessState(storeId);
  if (subscriptionAccess.accessState === "blocked") {
    const reason =
      subscriptionAccess.reason === "subscription_missing"
        ? "subscription_missing"
        : "subscription_inactive";

    return {
      limit: entitlements.limits.aiCreditsPerMonth,
      used: 0,
      reason,
      planSlug: entitlements.planSlug,
      fallbackReason: reason,
      month,
    };
  }

  const usage = await getCurrentMonthUsage(storeId, month);
  const used = getSharedAiCreditsUsed(usage);

  return {
    limit: entitlements.limits.aiCreditsPerMonth,
    used,
    reason: null,
    planSlug: entitlements.planSlug,
    fallbackReason: mapFallbackReason(entitlements.fallbackReason),
    month,
  };
}

export async function getAiBudgetStatus(
  storeId: string,
): Promise<AiBudgetStatus> {
  try {
    const budget = await resolveAiBudget(storeId);

    if (budget.reason) {
      return buildBlockedStatus(budget.reason, budget.limit);
    }

    return buildBudgetStatus({
      used: budget.used,
      limit: budget.limit,
      estimatedCredits: 0,
    });
  } catch {
    return buildBlockedStatus("usage_missing");
  }
}

export async function getAiAlertLevel(
  storeId: string,
): Promise<AiAlertLevel> {
  const status = await getAiBudgetStatus(storeId);
  return status.alertLevel;
}

export async function getAiUsageSummary(
  storeId: string,
): Promise<AiUsageSummary | null> {
  if (!storeId) {
    return null;
  }

  try {
    const budget = await resolveAiBudget(storeId);
    const status = budget.reason
      ? buildBlockedStatus(budget.reason, budget.limit)
      : buildBudgetStatus({
          used: budget.used,
          limit: budget.limit,
          estimatedCredits: 0,
        });

    return {
      storeId,
      month: budget.month,
      planSlug: budget.planSlug,
      fallbackReason: budget.fallbackReason,
      ...status,
    };
  } catch {
    return {
      storeId,
      month: getCurrentUsageMonth(),
      planSlug: "starter",
      fallbackReason: "usage_missing",
      ...buildBlockedStatus("usage_missing"),
    };
  }
}

export async function checkAiBudget(
  storeId: string,
  estimatedCredits?: number,
): Promise<AiBudgetStatus> {
  try {
    const budget = await resolveAiBudget(storeId);

    if (budget.reason) {
      return buildBlockedStatus(budget.reason, budget.limit);
    }

    return buildBudgetStatus({
      used: budget.used,
      limit: budget.limit,
      estimatedCredits,
    });
  } catch {
    return buildBlockedStatus("usage_missing");
  }
}

export async function consumeAiCredits(
  storeId: string,
  credits: number,
): Promise<ConsumeAiCreditsResult> {
  const normalizedCredits = normalizeCredits(credits);

  if (normalizedCredits <= 0) {
    return {
      ...(await getAiBudgetStatus(storeId)),
      consumed: 0,
    };
  }

  try {
    const budget = await resolveAiBudget(storeId);

    if (budget.reason) {
      return {
        ...buildBlockedStatus(budget.reason, budget.limit),
        consumed: 0,
      };
    }

    const debit = await tryIncrementAiCreditsWithinLimit(
      storeId,
      normalizedCredits,
      budget.limit,
      budget.month,
    );

    if (!debit.ok) {
      if (debit.reason === "budget_exceeded") {
        const status = await getAiBudgetStatus(storeId);
        return {
          ...status,
          allowed: false,
          reason: "budget_exceeded",
          consumed: 0,
        };
      }

      return {
        ...buildBlockedStatus("usage_missing", budget.limit),
        consumed: 0,
      };
    }

    const refreshed = await getAiBudgetStatus(storeId);

    return {
      ...refreshed,
      consumed: normalizedCredits,
    };
  } catch {
    return {
      ...buildBlockedStatus("usage_missing"),
      consumed: 0,
    };
  }
}
