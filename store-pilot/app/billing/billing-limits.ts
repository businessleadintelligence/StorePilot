import {
  BILLING_CONFIG,
  BILLING_PLAN_SLUGS,
  PRIMARY_BILLING_PLAN_SLUG,
  getBillingPlanPrice,
  type BillingPlanSlug,
} from "./plan-config";
import type { BillingAction, BillingPlanDefinition } from "./billing-types";

const PLAN_NAMES: Record<BillingPlanSlug, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  agency: "Agency",
};

const PLAN_DESCRIPTIONS: Record<BillingPlanSlug, string> = {
  starter: "For small stores getting started with StorePilot.",
  growth: "Primary plan for growing merchants.",
  pro: "For scaling merchants with advanced intelligence.",
  agency: "For agencies managing multiple client stores.",
};

const PLAN_STORE_CAPACITY: Record<BillingPlanSlug, { maxProducts: number; maxOrders: number; maxTeamMembers: number }> = {
  starter: { maxProducts: 1_000, maxOrders: 5_000, maxTeamMembers: 2 },
  growth: { maxProducts: 10_000, maxOrders: 50_000, maxTeamMembers: 10 },
  pro: { maxProducts: 100_000, maxOrders: 500_000, maxTeamMembers: 25 },
  agency: { maxProducts: 500_000, maxOrders: 2_000_000, maxTeamMembers: 50 },
};

function connectorSyncsPerMonth(syncFrequencyHours: number): number {
  return Math.floor((24 * 30) / syncFrequencyHours);
}

export function buildPlanDefinition(slug: BillingPlanSlug): BillingPlanDefinition {
  const plan = BILLING_CONFIG.plans[slug];
  const limits = BILLING_CONFIG.limits[slug];
  const features = BILLING_CONFIG.features[slug];
  const capacity = PLAN_STORE_CAPACITY[slug];

  const executiveCooAccess = !features.executiveCOO
    ? "limited"
    : features.advancedAnalytics
      ? "advanced"
      : "full";

  return {
    slug,
    name: PLAN_NAMES[slug],
    monthlyPriceUsd: plan.price,
    annualPriceUsd: plan.price * 10,
    description: PLAN_DESCRIPTIONS[slug],
    maxStores: limits.stores,
    aiExecutionsPerMonth: limits.aiExecutions,
    automationExecutionsPerMonth: limits.automations,
    connectorSyncsPerMonth: connectorSyncsPerMonth(limits.connectorSyncFrequencyHours),
    operationsPerMonth: limits.automations * 2,
    apiRequestsPerMonth: limits.aiExecutions * 5,
    backgroundJobsPerMonth: limits.automations * 10,
    dataExportsPerMonth: Math.max(2, Math.floor(limits.automations / 5)),
    maxProducts: capacity.maxProducts,
    maxOrders: capacity.maxOrders,
    maxTeamMembers: capacity.maxTeamMembers,
    syncFrequencyHours: limits.connectorSyncFrequencyHours,
    connectors: features.automationCenter
      ? ["ga4", "gsc", "pagespeed", "clarity"]
      : ["ga4", "gsc", "clarity"],
    connectorMode: features.automationCenter ? "all" : "single_optional",
    executiveCooAccess,
    operationsCenterEnabled: features.executiveCOO,
    automationCenterEnabled: features.automationCenter,
    productionHealthAlerts: features.advancedAnalytics
      ? "advanced"
      : features.executiveCOO
        ? "standard"
        : "basic",
    multiStoreAnalytics: features.advancedAnalytics,
    agencyFeatures: slug === "agency",
    primaryPlan: slug === PRIMARY_BILLING_PLAN_SLUG,
  };
}

export function getCanonicalPlan(slug: BillingPlanSlug): BillingPlanDefinition {
  if (!(slug in BILLING_CONFIG.plans)) {
    return buildPlanDefinition(BILLING_PLAN_SLUGS[0]!);
  }
  return buildPlanDefinition(slug);
}

export function listCanonicalPlans(): BillingPlanDefinition[] {
  return BILLING_PLAN_SLUGS.map((slug) => buildPlanDefinition(slug));
}

export function buildDbPlanSeedRecords(): Array<{
  name: string;
  slug: BillingPlanSlug;
  monthlyPrice: number;
  annualPrice: number;
  maxProducts: number;
  maxOrders: number;
  maxTeamMembers: number;
  aiCreditsPerMonth: number;
  active: boolean;
}> {
  return listCanonicalPlans().map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: plan.monthlyPriceUsd,
    annualPrice: plan.annualPriceUsd,
    maxProducts: plan.maxProducts,
    maxOrders: plan.maxOrders,
    maxTeamMembers: plan.maxTeamMembers,
    aiCreditsPerMonth: BILLING_CONFIG.limits[plan.slug].aiExecutions,
    active: true,
  }));
}

export function getPlanLimit(plan: BillingPlanDefinition, action: BillingAction): number {
  switch (action) {
    case "ai_execution":
      return plan.aiExecutionsPerMonth;
    case "automation_create":
    case "automation_execute":
      return plan.automationExecutionsPerMonth;
    case "connector_sync":
      return plan.connectorSyncsPerMonth;
    case "operations_create":
      return plan.operationsPerMonth;
    case "api_request":
      return plan.apiRequestsPerMonth;
    case "background_job":
      return plan.backgroundJobsPerMonth;
    case "data_export":
      return plan.dataExportsPerMonth;
    default:
      return 0;
  }
}

export function buildUpgradeMessage(planSlug: BillingPlanSlug, action: BillingAction): string {
  const primary = getCanonicalPlan(PRIMARY_BILLING_PLAN_SLUG);
  if (planSlug === primary.slug) {
    return `You've reached your ${action.replace(/_/g, " ")} limit. Contact support to increase capacity.`;
  }
  return `You've reached your ${action.replace(/_/g, " ")} limit on ${getCanonicalPlan(planSlug).name}. Upgrade to ${primary.name} ($${primary.monthlyPriceUsd}/month) to continue.`;
}

export function buildUpgradeRecommendation(currentSlug: BillingPlanSlug): string | null {
  const target = resolveUpgradeTarget(currentSlug);
  if (!target) {
    return null;
  }
  const plan = getCanonicalPlan(target);
  const messages: Partial<Record<BillingPlanSlug, string>> = {
    growth: "full AI and all connectors",
    pro: "faster sync and multi-store analytics",
    agency: "multi-client management",
  };
  const benefit = messages[target] ?? "expanded limits";
  return `Upgrade to ${plan.name} ($${plan.monthlyPriceUsd}/month) for ${benefit}.`;
}

export function comparePlanRank(left: BillingPlanSlug, right: BillingPlanSlug): number {
  return BILLING_PLAN_SLUGS.indexOf(left) - BILLING_PLAN_SLUGS.indexOf(right);
}

export function resolveDowngradeTarget(current: BillingPlanSlug): BillingPlanSlug | null {
  const index = BILLING_PLAN_SLUGS.indexOf(current);
  return index > 0 ? BILLING_PLAN_SLUGS[index - 1]! : null;
}

export function resolveUpgradeTarget(current: BillingPlanSlug): BillingPlanSlug | null {
  const index = BILLING_PLAN_SLUGS.indexOf(current);
  return index < BILLING_PLAN_SLUGS.length - 1 ? BILLING_PLAN_SLUGS[index + 1]! : null;
}

export function listPlanPrices(): Record<BillingPlanSlug, number> {
  return Object.fromEntries(
    BILLING_PLAN_SLUGS.map((slug) => [slug, getBillingPlanPrice(slug)]),
  ) as Record<BillingPlanSlug, number>;
}
