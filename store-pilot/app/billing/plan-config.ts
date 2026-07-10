/**
 * Legacy compatibility layer — all values derive from plan-registry.ts.
 * Do not add pricing, limits, or features here.
 */

import {
  GLOBAL_TRIAL_DAYS,
  PRIMARY_BILLING_PLAN_SLUG,
  PUBLIC_PLAN_SLUGS,
  getPlanEntry,
  isFeatureAvailable,
  listPublicPlans,
  resolveLimitValue,
  type BillingPlanSlug,
  type FeatureKey,
  type LimitKey,
} from "./plan-registry";

export type { BillingPlanSlug };
export {
  PUBLIC_PLAN_SLUGS as BILLING_PLAN_SLUGS,
  PRIMARY_BILLING_PLAN_SLUG,
  GLOBAL_TRIAL_DAYS,
};

export const BILLING_CONFIG = {
  trialDays: GLOBAL_TRIAL_DAYS,
  plans: Object.fromEntries(
    listPublicPlans().map((plan) => [
      plan.slug,
      { price: plan.monthlyPriceUsd, trialDays: plan.trialDays },
    ]),
  ) as Record<BillingPlanSlug, { price: number; trialDays: number }>,
  limits: Object.fromEntries(
    listPublicPlans().map((plan) => [
      plan.slug,
      {
        stores: resolveLimitValue(plan.limits.stores),
        aiExecutions: resolveLimitValue(plan.limits.ai_requests),
        automations: resolveLimitValue(plan.limits.automations),
        connectorSyncFrequencyHours: plan.limits.sync_frequency_hours === "unlimited"
          ? 1
          : plan.limits.sync_frequency_hours,
      },
    ]),
  ) as Record<
    BillingPlanSlug,
    {
      stores: number;
      aiExecutions: number;
      automations: number;
      connectorSyncFrequencyHours: number;
    }
  >,
  features: Object.fromEntries(
    listPublicPlans().map((plan) => [
      plan.slug,
      {
        executiveCOO: isFeatureAvailable(plan.slug, "executive_workspace"),
        automationCenter: isFeatureAvailable(plan.slug, "experiment_engine"),
        advancedAnalytics: isFeatureAvailable(plan.slug, "priority_ai"),
      },
    ]),
  ) as Record<
    BillingPlanSlug,
    {
      executiveCOO: boolean;
      automationCenter: boolean;
      advancedAnalytics: boolean;
    }
  >,
} as const;

export function getBillingTrialDays(planSlug?: BillingPlanSlug): number {
  if (planSlug) {
    return getPlanEntry(planSlug).trialDays;
  }
  return GLOBAL_TRIAL_DAYS;
}

export function getBillingPlanPrice(planSlug: BillingPlanSlug): number {
  return getPlanEntry(planSlug).monthlyPriceUsd;
}

export function getBillingPlanLimits(planSlug: BillingPlanSlug) {
  return BILLING_CONFIG.limits[planSlug];
}

export function getBillingPlanFeatures(planSlug: BillingPlanSlug) {
  return BILLING_CONFIG.features[planSlug];
}

export function getBillingPlanEntry(planSlug: BillingPlanSlug) {
  const plan = getPlanEntry(planSlug);
  return {
    plan: { price: plan.monthlyPriceUsd, trialDays: plan.trialDays },
    limits: BILLING_CONFIG.limits[planSlug],
    features: BILLING_CONFIG.features[planSlug],
  };
}

export type { FeatureKey, LimitKey };
