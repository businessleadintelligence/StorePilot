import { BILLING_CONFIG, getBillingTrialDays } from "./plan-config";
import { buildPlanDefinition, listCanonicalPlans } from "./billing-limits";
import type { BillingPlanSummary, OnboardingBillingSummary } from "./billing-types";

function buildPlanFeatureBullets(slug: keyof typeof BILLING_CONFIG.features): string[] {
  const limits = BILLING_CONFIG.limits[slug];
  const features = BILLING_CONFIG.features[slug];
  const bullets = [
    `${limits.stores} store${limits.stores === 1 ? "" : "s"}`,
    `${limits.aiExecutions.toLocaleString()} AI executions/month`,
    `${limits.automations} automations/month`,
    `${limits.connectorSyncFrequencyHours}h connector sync`,
  ];

  if (features.executiveCOO) {
    bullets.push("Executive COO access");
  }
  if (features.automationCenter) {
    bullets.push("Automation Center");
  }
  if (features.advancedAnalytics) {
    bullets.push("Advanced analytics");
  }

  return bullets;
}

export function buildBillingPlanSummary(slug: keyof typeof BILLING_CONFIG.plans): BillingPlanSummary {
  const plan = buildPlanDefinition(slug);
  return {
    slug,
    name: plan.name,
    priceUsd: BILLING_CONFIG.plans[slug].price,
    trialDays: getBillingTrialDays(slug),
    description: plan.description,
    features: buildPlanFeatureBullets(slug),
  };
}

export function buildOnboardingBillingSummary(): OnboardingBillingSummary {
  const trialDays = getBillingTrialDays();
  const primaryPlan = buildPlanDefinition("growth");

  return {
    trialDays,
    trialExplanation: `Every plan includes a ${trialDays}-day free trial. You approve billing in Shopify before any charge is created.`,
    upgradeMessage: `After your trial, continue with ${primaryPlan.name} at $${BILLING_CONFIG.plans.growth.price}/month for full AI and connector access.`,
    plans: listCanonicalPlans().map((plan) => buildBillingPlanSummary(plan.slug)),
  };
}
