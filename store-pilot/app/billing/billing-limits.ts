import {
  comparePlanRank,
  getPlanEntry,
  getResolvedPlanLimit,
  listPublicPlans,
  normalizePlanSlug,
  resolveDowngradeTarget,
  resolveUpgradeTarget,
  type BillingPlanSlug,
  type LimitKey,
} from "./plan-registry";
import type { BillingAction, BillingPlanDefinition } from "./billing-types";

function connectorSyncsPerMonth(syncFrequencyHours: number): number {
  return Math.floor((24 * 30) / syncFrequencyHours);
}

export function buildPlanDefinition(slug: BillingPlanSlug): BillingPlanDefinition {
  const plan = getPlanEntry(slug);
  const syncHours = getResolvedPlanLimit(slug, "sync_frequency_hours");

  return {
    slug: plan.slug,
    name: plan.name,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    annualPriceUsd: plan.annualPriceUsd,
    description: plan.description,
    maxStores: getResolvedPlanLimit(slug, "stores"),
    aiExecutionsPerMonth: getResolvedPlanLimit(slug, "ai_requests"),
    automationExecutionsPerMonth: getResolvedPlanLimit(slug, "automations"),
    connectorSyncsPerMonth: connectorSyncsPerMonth(syncHours),
    operationsPerMonth: getResolvedPlanLimit(slug, "background_jobs"),
    apiRequestsPerMonth: getResolvedPlanLimit(slug, "api_requests"),
    backgroundJobsPerMonth: getResolvedPlanLimit(slug, "background_jobs"),
    dataExportsPerMonth: getResolvedPlanLimit(slug, "exports"),
    maxProducts: getResolvedPlanLimit(slug, "products"),
    maxOrders: getResolvedPlanLimit(slug, "products"),
    maxTeamMembers: getResolvedPlanLimit(slug, "users"),
    syncFrequencyHours: syncHours,
    connectors:
      getResolvedPlanLimit(slug, "connectors") >= 4
        ? ["ga4", "gsc", "pagespeed", "clarity"]
        : ["ga4", "gsc", "clarity"],
    connectorMode: getResolvedPlanLimit(slug, "connectors") >= 4 ? "all" : "single_optional",
    executiveCooAccess: plan.features.executive_workspace
      ? plan.features.priority_ai
        ? "advanced"
        : "full"
      : "limited",
    operationsCenterEnabled: plan.features.operations_queue,
    automationCenterEnabled: plan.features.experiment_engine,
    productionHealthAlerts: plan.features.priority_ai
      ? "advanced"
      : plan.features.executive_workspace
        ? "standard"
        : "basic",
    multiStoreAnalytics: plan.features.priority_ai,
    workerQueueTier: plan.workerQueueTier,
    executiveBriefingsPerMonth: getResolvedPlanLimit(slug, "executive_briefings"),
    predictionsPerMonth: getResolvedPlanLimit(slug, "predictions"),
    experimentsPerMonth: getResolvedPlanLimit(slug, "experiments"),
    knowledgeGraphNodesLimit: getResolvedPlanLimit(slug, "knowledge_graph_nodes"),
    storageMbLimit: getResolvedPlanLimit(slug, "storage_mb"),
    reportsPerMonth: getResolvedPlanLimit(slug, "reports"),
    primaryPlan: plan.primaryPlan,
  };
}

export function getCanonicalPlan(slug: string | BillingPlanSlug): BillingPlanDefinition {
  return buildPlanDefinition(normalizePlanSlug(slug));
}

export function listCanonicalPlans(): BillingPlanDefinition[] {
  return listPublicPlans().map((plan) => buildPlanDefinition(plan.slug));
}

export { buildDbPlanSeedRecords } from "./plan-registry";

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

export function getRegistryLimit(slug: BillingPlanSlug, limit: LimitKey): number {
  return getResolvedPlanLimit(slug, limit);
}

export function buildUpgradeMessage(planSlug: BillingPlanSlug, action: BillingAction): string {
  if (normalizePlanSlug(planSlug) === "scale") {
    return `You've reached your ${action.replace(/_/g, " ")} limit. Contact support to increase capacity.`;
  }
  const target = resolveUpgradeTarget(normalizePlanSlug(planSlug));
  if (!target) {
    return `You've reached your ${action.replace(/_/g, " ")} limit.`;
  }
  const plan = getCanonicalPlan(target);
  return `You've reached your ${action.replace(/_/g, " ")} limit on ${getCanonicalPlan(planSlug).name}. Upgrade to ${plan.name} ($${plan.monthlyPriceUsd}/month) to continue.`;
}

export function buildUpgradeRecommendation(currentSlug: BillingPlanSlug): string | null {
  const target = resolveUpgradeTarget(normalizePlanSlug(currentSlug));
  if (!target) {
    return null;
  }
  const plan = getCanonicalPlan(target);
  const messages: Partial<Record<BillingPlanSlug, string>> = {
    growth: "prediction, experiment, and merchant intelligence",
    scale: "unlimited capacity, priority AI, and API access",
  };
  const benefit = messages[target] ?? "expanded limits";
  return `Upgrade to ${plan.name} ($${plan.monthlyPriceUsd}/month) for ${benefit}.`;
}

export { comparePlanRank, resolveDowngradeTarget, resolveUpgradeTarget };

export function listPlanPrices(): Record<BillingPlanSlug, number> {
  return Object.fromEntries(
    listPublicPlans().map((plan) => [plan.slug, plan.monthlyPriceUsd]),
  ) as Record<BillingPlanSlug, number>;
}

export { getBillingPlanPrice } from "./plan-config";
