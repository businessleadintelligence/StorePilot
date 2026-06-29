import type { StoreSubscriptionView } from "../services/billing.server";
import { getStoreSubscription } from "../services/billing.server";
import { evaluateSubscriptionAccess } from "../services/subscription.server";
import type {
  BillingPlanDefinition,
  BillingPlanSlug,
  CommercialSubscriptionStatus,
  BillingTrialStatus,
} from "./billing-types";
import { BILLING_CONFIG } from "./plan-config";
import { getCanonicalPlan } from "./billing-limits";

export function mapDbPlanSlugToCommercial(slug: string | null | undefined): BillingPlanSlug {
  if (slug === "growth" || slug === "pro" || slug === "agency" || slug === "starter") {
    return slug;
  }
  return "starter";
}

export function resolveCommercialSubscriptionStatus(
  subscription: StoreSubscriptionView | null,
  now = new Date(),
): CommercialSubscriptionStatus {
  if (!subscription) {
    return "pending";
  }

  const access = evaluateSubscriptionAccess(subscription, now);

  if (access.reason === "expired_trial" || access.reason === "expired_period") {
    return "expired";
  }

  switch (subscription.status) {
    case "trialing":
      return access.accessState === "allowed" ? "trialing" : "expired";
    case "active":
      return access.accessState === "allowed" ? "active" : "expired";
    case "past_due":
      return "past_due";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function buildTrialStatus(
  subscription: StoreSubscriptionView | null,
  now = new Date(),
): BillingTrialStatus {
  if (!subscription?.trialEndsAt || subscription.status !== "trialing") {
    return {
      active: false,
      trialStart: subscription?.currentPeriodStart.toISOString() ?? null,
      trialEnd: null,
      remainingDays: 0,
      expired: false,
      upgradePrompt: null,
    };
  }

  const remainingMs = subscription.trialEndsAt.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  const expired = remainingMs <= 0;

  return {
    active: !expired,
    trialStart: subscription.currentPeriodStart.toISOString(),
    trialEnd: subscription.trialEndsAt.toISOString(),
    remainingDays,
    expired,
    upgradePrompt: expired
      ? "Your trial has ended. Select a plan to continue using StorePilot."
      : remainingDays <= BILLING_CONFIG.trialDays
        ? `Your trial ends in ${remainingDays} day${remainingDays === 1 ? "" : "s"}. Upgrade to keep full access.`
        : null,
  };
}

export async function resolveStoreCommercialPlan(storeId: string): Promise<{
  plan: BillingPlanDefinition;
  subscription: StoreSubscriptionView | null;
  commercialStatus: CommercialSubscriptionStatus;
  trial: BillingTrialStatus;
}> {
  const subscription = await getStoreSubscription(storeId);
  const planSlug = mapDbPlanSlugToCommercial(subscription?.plan.slug);
  return {
    plan: getCanonicalPlan(planSlug),
    subscription,
    commercialStatus: resolveCommercialSubscriptionStatus(subscription),
    trial: buildTrialStatus(subscription),
  };
}

export function isCommercialAccessAllowed(status: CommercialSubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export function isFeatureEnabled(
  plan: BillingPlanDefinition,
  feature: "operations" | "automation" | "advanced_coo" | "agency",
): boolean {
  switch (feature) {
    case "operations":
      return plan.operationsCenterEnabled;
    case "automation":
      return plan.automationCenterEnabled;
    case "advanced_coo":
      return plan.executiveCooAccess === "advanced";
    case "agency":
      return plan.agencyFeatures;
    default:
      return false;
  }
}
