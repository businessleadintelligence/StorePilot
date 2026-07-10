import { GLOBAL_TRIAL_DAYS, getPlanEntry, listPublicPlans, type BillingPlanSlug } from "./plan-registry";
import { buildPlanDefinition } from "./billing-limits";
import type { BillingPlanSummary, OnboardingBillingSummary } from "./billing-types";

function buildPlanFeatureBullets(slug: BillingPlanSlug): string[] {
  const plan = getPlanEntry(slug);
  const bullets: string[] = [
    `${plan.limits.products === "unlimited" ? "Unlimited" : plan.limits.products.toLocaleString()} products`,
    `${plan.limits.ai_requests === "unlimited" ? "Unlimited" : plan.limits.ai_requests.toLocaleString()} AI requests/month`,
    plan.limits.executive_briefings === "unlimited"
      ? "Unlimited executive briefings"
      : `${plan.limits.executive_briefings} executive briefings/month`,
    plan.limits.sync_frequency_hours === "unlimited" || plan.limits.sync_frequency_hours === 1
      ? "Hourly sync"
      : "Daily sync",
  ];

  if (plan.features.prediction_engine) bullets.push("Prediction Engine");
  if (plan.features.experiment_engine) bullets.push("Experiment Intelligence");
  if (plan.features.merchant_intelligence) bullets.push("Merchant Intelligence");
  if (plan.features.api_access) bullets.push("API access");
  if (plan.features.priority_ai) bullets.push("Priority AI");

  return bullets;
}

export function buildBillingPlanSummary(slug: BillingPlanSlug): BillingPlanSummary {
  const plan = buildPlanDefinition(slug);
  return {
    slug,
    name: plan.name,
    priceUsd: plan.monthlyPriceUsd,
    trialDays: GLOBAL_TRIAL_DAYS,
    description: plan.description,
    features: buildPlanFeatureBullets(slug),
  };
}

export function buildOnboardingBillingSummary(): OnboardingBillingSummary {
  const primaryPlan = buildPlanDefinition("growth");

  return {
    trialDays: GLOBAL_TRIAL_DAYS,
    trialExplanation: `Every plan includes a ${GLOBAL_TRIAL_DAYS}-day free trial. You approve billing in Shopify before any charge is created.`,
    upgradeMessage: `After your trial, continue with ${primaryPlan.name} at $${primaryPlan.monthlyPriceUsd}/month for prediction and experiment intelligence.`,
    plans: listPublicPlans().map((plan) => buildBillingPlanSummary(plan.slug)),
  };
}
