import type { BillingDashboardData, BillingPlanSlug } from "./billing-types";
import { BILLING_PLAN_SLUGS } from "./billing-types";

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /charge[_-]?id/i,
  /payment[_-]?token/i,
  /shopifySubscription/i,
];

export function validateBillingPlanSlug(slug: string): slug is BillingPlanSlug {
  return (BILLING_PLAN_SLUGS as readonly string[]).includes(slug);
}

export function validateBillingDashboard(dashboard: BillingDashboardData): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!dashboard.storeId.trim()) {
    errors.push("storeId required");
  }

  if (dashboard.currentPlan.monthlyPriceUsd !== dashboard.limits.monthlyPriceUsd) {
    errors.push("plan pricing mismatch in dashboard");
  }

  for (const plan of dashboard.plans) {
    const canonical = dashboard.plans.find((item) => item.slug === plan.slug);
    if (canonical && canonical.monthlyPriceUsd !== plan.monthlyPriceUsd) {
      errors.push(`pricing mismatch for ${plan.slug}`);
    }
  }

  const serialized = JSON.stringify(dashboard);
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(serialized)) {
      errors.push("dashboard contains sensitive billing identifiers");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateBillingIntent(intent: string): { ok: boolean; error: string | null } {
  const allowed = [
    "upgrade-plan",
    "downgrade-plan",
    "cancel-subscription",
    "approve-subscription",
    "refresh-usage",
  ];

  if (!allowed.includes(intent)) {
    return { ok: false, error: "unknown_intent" };
  }

  return { ok: true, error: null };
}
