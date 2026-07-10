import {
  GLOBAL_TRIAL_DAYS,
  PUBLIC_PLAN_SLUGS,
  listPublicPlans,
} from "./plan-registry";

export type BillingConfigValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateBillingRegistry(): BillingConfigValidationResult {
  const errors: string[] = [];
  const prices = new Set<number>();

  for (const plan of listPublicPlans()) {
    prices.add(plan.monthlyPriceUsd);

    if (plan.trialDays !== GLOBAL_TRIAL_DAYS) {
      errors.push(
        `trialDays mismatch for "${plan.slug}": plan has ${plan.trialDays}, global is ${GLOBAL_TRIAL_DAYS}`,
      );
    }

    if (plan.monthlyPriceUsd <= 0) {
      errors.push(`invalid price for plan "${plan.slug}"`);
    }
  }

  if (PUBLIC_PLAN_SLUGS.length !== 3) {
    errors.push("public plan registry must contain exactly 3 plans");
  }

  if (prices.size !== PUBLIC_PLAN_SLUGS.length) {
    errors.push("duplicate pricing definitions detected across plans");
  }

  return { ok: errors.length === 0, errors };
}

/** @deprecated use validateBillingRegistry */
export function validateBillingConfig(): BillingConfigValidationResult {
  return validateBillingRegistry();
}

export function assertBillingRegistryValid(): void {
  const result = validateBillingRegistry();
  if (!result.ok) {
    throw new Error(`Invalid billing registry:\n${result.errors.join("\n")}`);
  }
}

/** @deprecated use assertBillingRegistryValid */
export function assertBillingConfigValid(): void {
  assertBillingRegistryValid();
}

if (process.env.NODE_ENV !== "production") {
  assertBillingRegistryValid();
}
