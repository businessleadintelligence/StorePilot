import type { SubscriptionStatus, UsageMetric } from "@prisma/client";

import prisma from "../db.server";
import {
  STARTER_PLAN_SLUG,
  getCurrentMonthUsage,
  getCurrentUsageMonth,
  getStoreSubscription,
  recordUsage,
  tryIncrementAiCreditsWithinLimit,
  type StorePlanView,
} from "./billing.server";
import { getSubscriptionAccessState } from "./subscription.server";
import type { AiCostControlErrorCode } from "./ai-cost-control.server";

export type EntitlementErrorCode =
  | "limit_exceeded"
  | "subscription_missing"
  | "subscription_inactive"
  | "plan_missing"
  | "usage_missing";

export type UsageLimitCheck = {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  reason: EntitlementErrorCode | null;
};

export type StoreEntitlements = {
  storeId: string;
  planSlug: string;
  planName: string;
  subscriptionStatus: SubscriptionStatus | null;
  limits: {
    products: number;
    orders: number;
    aiCreditsPerMonth: number;
    maxTeamMembers: number;
  };
  fallbackReason: EntitlementErrorCode | null;
};

export type UsageSummary = {
  storeId: string;
  month: string;
  products: UsageLimitCheck;
  orders: UsageLimitCheck;
  ai_requests: UsageLimitCheck;
  reports_generated: UsageLimitCheck;
  sharedAiCredits: {
    limit: number;
    used: number;
    remaining: number;
  };
};

export type RecordUsageIfAllowedResult = UsageLimitCheck & {
  recorded: boolean;
};

const ENTITLEMENT_METRICS: UsageMetric[] = [
  "products",
  "orders",
  "ai_requests",
  "reports_generated",
];

function normalizeIncrement(increment?: number): number {
  if (increment === undefined) {
    return 1;
  }

  if (!Number.isFinite(increment)) {
    return 0;
  }

  return Math.max(0, Math.floor(increment));
}

function buildLimitCheck(input: {
  used: number;
  limit: number;
  increment?: number;
  reason?: EntitlementErrorCode | null;
}): UsageLimitCheck {
  const used = Math.max(0, input.used);
  const limit = Math.max(0, input.limit);
  const increment = normalizeIncrement(input.increment);
  const remaining = Math.max(0, limit - used);
  const projected = used + increment;

  if (input.reason) {
    return {
      allowed: false,
      remaining,
      limit,
      used,
      reason: input.reason,
    };
  }

  if (projected <= limit) {
    return {
      allowed: true,
      remaining,
      limit,
      used,
      reason: null,
    };
  }

  return {
    allowed: false,
    remaining,
    limit,
    used,
    reason: "limit_exceeded",
  };
}

function toPlanView(plan: {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: unknown;
  annualPrice: unknown;
  maxProducts: number;
  maxOrders: number;
  maxTeamMembers: number;
  aiCreditsPerMonth: number;
  active: boolean;
}): StorePlanView {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: Number(plan.monthlyPrice),
    annualPrice: Number(plan.annualPrice),
    maxProducts: plan.maxProducts,
    maxOrders: plan.maxOrders,
    maxTeamMembers: plan.maxTeamMembers,
    aiCreditsPerMonth: plan.aiCreditsPerMonth,
    active: plan.active,
  };
}

function buildSubscriptionInactiveCheck(limit = 0): UsageLimitCheck {
  return {
    allowed: false,
    remaining: 0,
    limit,
    used: 0,
    reason: "subscription_inactive",
  };
}

function buildSubscriptionMissingCheck(): UsageLimitCheck {
  return {
    allowed: false,
    remaining: 0,
    limit: 0,
    used: 0,
    reason: "subscription_missing",
  };
}

async function resolveSubscriptionAccessBlock(
  storeId: string,
): Promise<UsageLimitCheck | null> {
  const access = await getSubscriptionAccessState(storeId);

  if (access.accessState === "allowed") {
    return null;
  }

  if (access.reason === "subscription_missing") {
    return buildSubscriptionMissingCheck();
  }

  return buildSubscriptionInactiveCheck();
}

async function resolveStorePlan(storeId: string): Promise<{
  plan: StorePlanView | null;
  subscriptionStatus: SubscriptionStatus | null;
  fallbackReason: EntitlementErrorCode | null;
}> {
  const subscription = await getStoreSubscription(storeId);

  if (subscription?.plan) {
    return {
      plan: subscription.plan,
      subscriptionStatus: subscription.status,
      fallbackReason: null,
    };
  }

  try {
    const starterPlan = await prisma.plan.findUnique({
      where: { slug: STARTER_PLAN_SLUG },
    });

    if (!starterPlan) {
      return {
        plan: null,
        subscriptionStatus: null,
        fallbackReason: "plan_missing",
      };
    }

    return {
      plan: toPlanView(starterPlan),
      subscriptionStatus: null,
      fallbackReason: "subscription_missing",
    };
  } catch {
    return {
      plan: null,
      subscriptionStatus: null,
      fallbackReason: "plan_missing",
    };
  }
}

async function getProductCount(storeId: string): Promise<number | null> {
  try {
    return await prisma.product.count({
      where: { storeId },
    });
  } catch {
    return null;
  }
}

async function getOrderCount(storeId: string): Promise<number | null> {
  try {
    return await prisma.order.count({
      where: { storeId },
    });
  } catch {
    return null;
  }
}

async function getMonthlyUsage(
  storeId: string,
  month: string,
): Promise<{ usage: Record<UsageMetric, number>; error: boolean }> {
  const usage = await getCurrentMonthUsage(storeId, month);

  if (!storeId) {
    return {
      usage,
      error: true,
    };
  }

  return {
    usage,
    error: false,
  };
}

function getSharedAiCreditsUsed(
  usage: Record<UsageMetric, number>,
): number {
  return Math.max(0, usage.ai_requests) + Math.max(0, usage.reports_generated);
}

function mapAiCostControlReason(
  reason: AiCostControlErrorCode | null,
): EntitlementErrorCode | null {
  if (!reason) {
    return null;
  }

  if (reason === "budget_exceeded") {
    return "limit_exceeded";
  }

  if (
    reason === "plan_missing" ||
    reason === "subscription_missing" ||
    reason === "subscription_inactive" ||
    reason === "usage_missing"
  ) {
    if (reason === "subscription_missing") {
      return "subscription_missing";
    }

    if (reason === "subscription_inactive") {
      return "subscription_inactive";
    }

    return reason;
  }

  return "usage_missing";
}

function mapConsumeResultToUsageLimitCheck(
  consumed: {
    allowed: boolean;
    remaining: number;
    limit: number;
    used: number;
    reason: AiCostControlErrorCode | null;
  },
): UsageLimitCheck {
  return {
    allowed: consumed.allowed,
    remaining: consumed.remaining,
    limit: consumed.limit,
    used: consumed.used,
    reason: mapAiCostControlReason(consumed.reason),
  };
}
function buildPlanMissingCheck(): UsageLimitCheck {
  return {
    allowed: false,
    remaining: 0,
    limit: 0,
    used: 0,
    reason: "plan_missing",
  };
}

export async function getStoreEntitlements(
  storeId: string,
): Promise<StoreEntitlements | null> {
  if (!storeId) {
    return null;
  }

  const resolved = await resolveStorePlan(storeId);

  if (!resolved.plan) {
    return {
      storeId,
      planSlug: STARTER_PLAN_SLUG,
      planName: "Starter",
      subscriptionStatus: null,
      limits: {
        products: 0,
        orders: 0,
        aiCreditsPerMonth: 0,
        maxTeamMembers: 0,
      },
      fallbackReason: resolved.fallbackReason ?? "plan_missing",
    };
  }

  return {
    storeId,
    planSlug: resolved.plan.slug,
    planName: resolved.plan.name,
    subscriptionStatus: resolved.subscriptionStatus,
    limits: {
      products: resolved.plan.maxProducts,
      orders: resolved.plan.maxOrders,
      aiCreditsPerMonth: resolved.plan.aiCreditsPerMonth,
      maxTeamMembers: resolved.plan.maxTeamMembers,
    },
    fallbackReason: resolved.fallbackReason,
  };
}

export async function checkUsageLimit(
  storeId: string,
  metric: UsageMetric,
  increment?: number,
): Promise<UsageLimitCheck> {
  if (!storeId || !ENTITLEMENT_METRICS.includes(metric)) {
    return buildPlanMissingCheck();
  }

  const resolved = await resolveStorePlan(storeId);

  if (!resolved.plan) {
    return buildPlanMissingCheck();
  }

  const subscriptionBlock = await resolveSubscriptionAccessBlock(storeId);
  if (subscriptionBlock) {
    return {
      ...subscriptionBlock,
      limit:
        metric === "products"
          ? resolved.plan.maxProducts
          : metric === "orders"
            ? resolved.plan.maxOrders
            : resolved.plan.aiCreditsPerMonth,
    };
  }

  const month = getCurrentUsageMonth();

  switch (metric) {
    case "products": {
      const used = await getProductCount(storeId);

      if (used === null) {
        return {
          allowed: false,
          remaining: 0,
          limit: resolved.plan.maxProducts,
          used: 0,
          reason: "usage_missing",
        };
      }

      return buildLimitCheck({
        used,
        limit: resolved.plan.maxProducts,
        increment,
      });
    }

    case "orders": {
      const used = await getOrderCount(storeId);

      if (used === null) {
        return {
          allowed: false,
          remaining: 0,
          limit: resolved.plan.maxOrders,
          used: 0,
          reason: "usage_missing",
        };
      }

      return buildLimitCheck({
        used,
        limit: resolved.plan.maxOrders,
        increment,
      });
    }

    case "ai_requests":
    case "reports_generated": {
      const { usage, error } = await getMonthlyUsage(storeId, month);

      if (error) {
        return {
          allowed: false,
          remaining: 0,
          limit: resolved.plan.aiCreditsPerMonth,
          used: 0,
          reason: "usage_missing",
        };
      }

      const sharedUsed = getSharedAiCreditsUsed(usage);

      return buildLimitCheck({
        used: sharedUsed,
        limit: resolved.plan.aiCreditsPerMonth,
        increment,
      });
    }

    default:
      return buildPlanMissingCheck();
  }
}

export async function recordUsageIfAllowed(
  storeId: string,
  metric: UsageMetric,
  increment?: number,
): Promise<RecordUsageIfAllowedResult> {
  if (metric === "ai_requests") {
    const amount = normalizeIncrement(increment);
    const { consumeAiCredits } = await import("./ai-cost-control.server");
    const consumed = await consumeAiCredits(storeId, amount);

    if (consumed.consumed === 0) {
      return {
        ...mapConsumeResultToUsageLimitCheck(consumed),
        recorded: false,
      };
    }

    const refreshed = await checkUsageLimit(storeId, metric, 0);
    return {
      ...refreshed,
      recorded: true,
    };
  }

  if (metric === "reports_generated") {
    const amount = normalizeIncrement(increment);
    const check = await checkUsageLimit(storeId, metric, amount);

    if (!check.allowed) {
      return {
        ...check,
        recorded: false,
      };
    }

    const entitlements = await getStoreEntitlements(storeId);
    if (!entitlements || entitlements.fallbackReason === "plan_missing") {
      return {
        ...buildPlanMissingCheck(),
        recorded: false,
      };
    }

    const debit = await tryIncrementAiCreditsWithinLimit(
      storeId,
      amount,
      entitlements.limits.aiCreditsPerMonth,
      getCurrentUsageMonth(),
      "reports_generated",
    );

    if (!debit.ok) {
      const reason =
        debit.reason === "budget_exceeded" ? "limit_exceeded" : "usage_missing";
      return {
        allowed: false,
        remaining: check.remaining,
        limit: check.limit,
        used: check.used,
        reason,
        recorded: false,
      };
    }

    const refreshed = await checkUsageLimit(storeId, metric, 0);
    return {
      ...refreshed,
      recorded: true,
    };
  }

  const check = await checkUsageLimit(storeId, metric, increment);

  if (!check.allowed) {
    return {
      ...check,
      recorded: false,
    };
  }

  const amount = normalizeIncrement(increment);
  const recorded = await recordUsage(
    storeId,
    metric,
    amount,
    getCurrentUsageMonth(),
  );

  if (!recorded) {
    return {
      ...check,
      allowed: false,
      reason: "usage_missing",
      recorded: false,
    };
  }

  return {
    ...check,
    recorded: true,
  };
}

export async function getUsageSummary(storeId: string): Promise<UsageSummary | null> {
  if (!storeId) {
    return null;
  }

  const entitlements = await getStoreEntitlements(storeId);
  const month = getCurrentUsageMonth();

  if (!entitlements) {
    return null;
  }

  if (entitlements.fallbackReason === "plan_missing") {
    const missing = buildPlanMissingCheck();
    return {
      storeId,
      month,
      products: missing,
      orders: missing,
      ai_requests: missing,
      reports_generated: missing,
      sharedAiCredits: {
        limit: 0,
        used: 0,
        remaining: 0,
      },
    };
  }

  const [products, orders, aiRequests, reportsGenerated] = await Promise.all([
    checkUsageLimit(storeId, "products", 0),
    checkUsageLimit(storeId, "orders", 0),
    checkUsageLimit(storeId, "ai_requests", 0),
    checkUsageLimit(storeId, "reports_generated", 0),
  ]);

  const { usage } = await getMonthlyUsage(storeId, month);
  const sharedUsed = getSharedAiCreditsUsed(usage);
  const sharedLimit = entitlements.limits.aiCreditsPerMonth;

  return {
    storeId,
    month,
    products,
    orders,
    ai_requests: aiRequests,
    reports_generated: reportsGenerated,
    sharedAiCredits: {
      limit: sharedLimit,
      used: sharedUsed,
      remaining: Math.max(0, sharedLimit - sharedUsed),
    },
  };
}
