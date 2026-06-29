import { BILLING_CONFIG, BILLING_PLAN_SLUGS, type BillingPlanSlug } from "./plan-config";

export type BillingConfigValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateBillingConfig(config = BILLING_CONFIG): BillingConfigValidationResult {
  const errors: string[] = [];
  const planSlugs = Object.keys(config.plans) as BillingPlanSlug[];
  const limitSlugs = Object.keys(config.limits);
  const featureSlugs = Object.keys(config.features);
  const prices = new Set<number>();

  for (const slug of planSlugs) {
    const plan = config.plans[slug];
    prices.add(plan.price);

    if (!(slug in config.limits)) {
      errors.push(`missing limits for plan "${slug}"`);
    }

    if (!(slug in config.features)) {
      errors.push(`missing features for plan "${slug}"`);
    }

    if (plan.trialDays !== config.trialDays) {
      errors.push(
        `trialDays mismatch for "${slug}": plan has ${plan.trialDays}, global trialDays is ${config.trialDays}`,
      );
    }

    if (plan.price <= 0) {
      errors.push(`invalid price for plan "${slug}"`);
    }
  }

  for (const slug of limitSlugs) {
    if (!planSlugs.includes(slug as BillingPlanSlug)) {
      errors.push(`limits defined for unknown plan "${slug}"`);
    }
  }

  for (const slug of featureSlugs) {
    if (!planSlugs.includes(slug as BillingPlanSlug)) {
      errors.push(`features defined for unknown plan "${slug}"`);
    }
  }

  if (planSlugs.length !== BILLING_PLAN_SLUGS.length) {
    errors.push("plan slug registry out of sync with BILLING_PLAN_SLUGS");
  }

  if (prices.size !== planSlugs.length) {
    errors.push("duplicate pricing definitions detected across plans");
  }

  return { ok: errors.length === 0, errors };
}

export function assertBillingConfigValid(config = BILLING_CONFIG): void {
  const result = validateBillingConfig(config);
  if (!result.ok) {
    throw new Error(`Invalid billing configuration:\n${result.errors.join("\n")}`);
  }
}

if (process.env.NODE_ENV !== "production") {
  assertBillingConfigValid();
}
