import type { SubscriptionStatus } from "@prisma/client";

import prisma from "../db.server";
import { getResolvedPlanLimit, normalizePlanSlug, getPlanEntry } from "../billing/plan-registry";
import {
  STARTER_PLAN_SLUG,
  getStoreSubscription,
  type StorePlanView,
} from "./billing.server";
import type { EntitlementErrorCode } from "./access-control-types.server";

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

export async function resolveStorePlan(storeId: string): Promise<{
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

export async function getStoreEntitlements(
  storeId: string,
): Promise<StoreEntitlements | null> {
  if (!storeId) {
    return null;
  }

  const resolved = await resolveStorePlan(storeId);

  if (!resolved.plan) {
    const starterSlug = normalizePlanSlug(STARTER_PLAN_SLUG);
    return {
      storeId,
      planSlug: starterSlug,
      planName: "Starter",
      subscriptionStatus: null,
      limits: {
        products: getResolvedPlanLimit(starterSlug, "products"),
        orders: getResolvedPlanLimit(starterSlug, "products"),
        aiCreditsPerMonth: getResolvedPlanLimit(starterSlug, "ai_requests"),
        maxTeamMembers: getResolvedPlanLimit(starterSlug, "users"),
      },
      fallbackReason: resolved.fallbackReason ?? "plan_missing",
    };
  }

  const planSlug = normalizePlanSlug(resolved.plan.slug);

  return {
    storeId,
    planSlug,
    planName: getPlanEntry(planSlug).name,
    subscriptionStatus: resolved.subscriptionStatus,
    limits: {
      products: getResolvedPlanLimit(planSlug, "products"),
      orders: getResolvedPlanLimit(planSlug, "products"),
      aiCreditsPerMonth: getResolvedPlanLimit(planSlug, "ai_requests"),
      maxTeamMembers: getResolvedPlanLimit(planSlug, "users"),
    },
    fallbackReason: resolved.fallbackReason,
  };
}
