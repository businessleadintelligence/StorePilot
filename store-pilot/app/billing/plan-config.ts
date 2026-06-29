export const BILLING_CONFIG = {
  trialDays: 3,

  plans: {
    starter: {
      price: 29,
      trialDays: 3,
    },

    growth: {
      price: 79,
      trialDays: 3,
    },

    pro: {
      price: 199,
      trialDays: 3,
    },

    agency: {
      price: 399,
      trialDays: 3,
    },
  },

  limits: {
    starter: {
      stores: 1,
      aiExecutions: 1000,
      automations: 10,
      connectorSyncFrequencyHours: 24,
    },

    growth: {
      stores: 1,
      aiExecutions: 10000,
      automations: 100,
      connectorSyncFrequencyHours: 6,
    },

    pro: {
      stores: 3,
      aiExecutions: 50000,
      automations: 500,
      connectorSyncFrequencyHours: 2,
    },

    agency: {
      stores: 10,
      aiExecutions: 200000,
      automations: 2000,
      connectorSyncFrequencyHours: 1,
    },
  },

  features: {
    starter: {
      executiveCOO: false,
      automationCenter: false,
      advancedAnalytics: false,
    },

    growth: {
      executiveCOO: true,
      automationCenter: true,
      advancedAnalytics: false,
    },

    pro: {
      executiveCOO: true,
      automationCenter: true,
      advancedAnalytics: true,
    },

    agency: {
      executiveCOO: true,
      automationCenter: true,
      advancedAnalytics: true,
    },
  },
} as const;

export type BillingPlanSlug = keyof typeof BILLING_CONFIG.plans;

export const BILLING_PLAN_SLUGS = Object.keys(BILLING_CONFIG.plans) as BillingPlanSlug[];

export const PRIMARY_BILLING_PLAN_SLUG: BillingPlanSlug = "growth";

export function getBillingTrialDays(planSlug?: BillingPlanSlug): number {
  if (planSlug) {
    return BILLING_CONFIG.plans[planSlug].trialDays;
  }
  return BILLING_CONFIG.trialDays;
}

export function getBillingPlanPrice(planSlug: BillingPlanSlug): number {
  return BILLING_CONFIG.plans[planSlug].price;
}

export function getBillingPlanLimits(planSlug: BillingPlanSlug) {
  return BILLING_CONFIG.limits[planSlug];
}

export function getBillingPlanFeatures(planSlug: BillingPlanSlug) {
  return BILLING_CONFIG.features[planSlug];
}

export function getBillingPlanEntry(planSlug: BillingPlanSlug) {
  return {
    plan: BILLING_CONFIG.plans[planSlug],
    limits: getBillingPlanLimits(planSlug),
    features: getBillingPlanFeatures(planSlug),
  };
}
