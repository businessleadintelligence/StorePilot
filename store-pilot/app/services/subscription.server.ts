import type { SubscriptionStatus } from "@prisma/client";

import {
  getStoreSubscription,
  type StoreSubscriptionView,
} from "./billing.server";

export type SubscriptionAccessState = "allowed" | "blocked";

export type SubscriptionAccessReason =
  | "active"
  | "trialing"
  | "cancelled"
  | "past_due"
  | "expired_trial"
  | "expired_period"
  | "invalid_trial"
  | "subscription_missing";

export type SubscriptionStatusSummary = {
  status: SubscriptionStatus | null;
  planSlug: string | null;
  planName: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  accessState: SubscriptionAccessState;
  accessReason: SubscriptionAccessReason;
};

export function evaluateSubscriptionAccess(
  subscription: StoreSubscriptionView | null,
  now = new Date(),
): { accessState: SubscriptionAccessState; reason: SubscriptionAccessReason } {
  if (!subscription) {
    return { accessState: "blocked", reason: "subscription_missing" };
  }

  switch (subscription.status) {
    case "trialing": {
      if (!subscription.trialEndsAt) {
        return { accessState: "blocked", reason: "invalid_trial" };
      }

      if (subscription.trialEndsAt <= now) {
        return { accessState: "blocked", reason: "expired_trial" };
      }

      return { accessState: "allowed", reason: "trialing" };
    }
    case "active": {
      if (subscription.currentPeriodEnd < now) {
        return { accessState: "blocked", reason: "expired_period" };
      }

      return { accessState: "allowed", reason: "active" };
    }
    case "cancelled":
      return { accessState: "blocked", reason: "cancelled" };
    case "past_due":
      return { accessState: "blocked", reason: "past_due" };
    default:
      return { accessState: "blocked", reason: "subscription_missing" };
  }
}

export async function getSubscriptionAccessState(storeId: string): Promise<{
  accessState: SubscriptionAccessState;
  reason: SubscriptionAccessReason;
}> {
  const subscription = await getStoreSubscription(storeId);
  return evaluateSubscriptionAccess(subscription);
}

export async function getSubscriptionStatusSummary(
  storeId: string,
): Promise<SubscriptionStatusSummary> {
  const subscription = await getStoreSubscription(storeId);
  const access = evaluateSubscriptionAccess(subscription);

  return {
    status: subscription?.status ?? null,
    planSlug: subscription?.plan.slug ?? null,
    planName: subscription?.plan.name ?? null,
    trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    accessState: access.accessState,
    accessReason: access.reason,
  };
}
