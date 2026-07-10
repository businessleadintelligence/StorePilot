/**
 * StorePilot Plan Registry — single source of truth for pricing, features, and limits.
 * All billing, entitlements, dashboard, website, Shopify, and feature gates derive from here.
 */

export const PUBLIC_PLAN_SLUGS = ["starter", "growth", "scale"] as const;
export type BillingPlanSlug = (typeof PUBLIC_PLAN_SLUGS)[number];

/** Legacy slugs map to current public plans (backward compatible). */
export const LEGACY_PLAN_SLUG_MAP: Record<string, BillingPlanSlug> = {
  pro: "scale",
  agency: "scale",
};

export const PRIMARY_BILLING_PLAN_SLUG: BillingPlanSlug = "growth";
export const GLOBAL_TRIAL_DAYS = 3;

export const FEATURE_KEYS = [
  "executive_briefing",
  "business_memory",
  "knowledge_graph",
  "root_cause",
  "daily_operating_plan",
  "weekly_executive_report",
  "executive_workspace",
  "decision_timeline",
  "privacy_center",
  "prediction_engine",
  "experiment_engine",
  "merchant_intelligence",
  "business_stability",
  "adaptive_learning",
  "prediction_workspace",
  "experiment_workspace",
  "timeline",
  "operations_queue",
  "priority_worker",
  "priority_ai",
  "api_access",
  "priority_support",
  "white_glove",
  "beta_features",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const LIMIT_KEYS = [
  "products",
  "users",
  "stores",
  "ai_requests",
  "executive_briefings",
  "predictions",
  "experiments",
  "knowledge_graph_nodes",
  "workers",
  "storage_mb",
  "api_requests",
  "sync_frequency_hours",
  "background_jobs",
  "connectors",
  "exports",
  "reports",
  "automations",
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

export type PlanLimitValue = number | "unlimited";

export type WorkerQueueTier = "standard" | "normal" | "priority";

export type FeatureRegistryEntry = {
  key: FeatureKey;
  name: string;
  description: string;
  minimumPlan: BillingPlanSlug;
  upgradeText: string;
  documentationPath: string;
};

export type PlanRegistryEntry = {
  slug: BillingPlanSlug;
  name: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  description: string;
  trialDays: number;
  primaryPlan: boolean;
  workerQueueTier: WorkerQueueTier;
  features: Record<FeatureKey, boolean>;
  limits: Record<LimitKey, PlanLimitValue>;
};

const FEATURE_REGISTRY: Record<FeatureKey, FeatureRegistryEntry> = {
  executive_briefing: {
    key: "executive_briefing",
    name: "Executive Briefing",
    description: "Daily AI executive briefing with prioritized actions.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#executive-briefing",
  },
  business_memory: {
    key: "business_memory",
    name: "Business Memory",
    description: "Durable merchant business memory and DNA.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#business-memory",
  },
  knowledge_graph: {
    key: "knowledge_graph",
    name: "Knowledge Graph",
    description: "Business knowledge graph and relationships.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#knowledge-graph",
  },
  root_cause: {
    key: "root_cause",
    name: "Root Cause",
    description: "Root cause analysis workspace.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#root-cause",
  },
  daily_operating_plan: {
    key: "daily_operating_plan",
    name: "Daily Operating Plan",
    description: "Daily operating plan generation.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#daily-operating-plan",
  },
  weekly_executive_report: {
    key: "weekly_executive_report",
    name: "Weekly Executive Report",
    description: "Weekly executive summary reports.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#weekly-executive-report",
  },
  executive_workspace: {
    key: "executive_workspace",
    name: "Executive Workspace",
    description: "Executive intelligence workspace.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#executive-workspace",
  },
  decision_timeline: {
    key: "decision_timeline",
    name: "Decision Timeline",
    description: "Timeline of merchant decisions and outcomes.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#decision-timeline",
  },
  privacy_center: {
    key: "privacy_center",
    name: "Privacy Center",
    description: "Privacy and compliance center.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#privacy-center",
  },
  timeline: {
    key: "timeline",
    name: "Business Timeline",
    description: "Unified business timeline.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#timeline",
  },
  operations_queue: {
    key: "operations_queue",
    name: "Operations Queue",
    description: "Operations task queue.",
    minimumPlan: "starter",
    upgradeText: "Included on Starter.",
    documentationPath: "/docs/BILLING_ARCHITECTURE.md#operations-queue",
  },
  prediction_engine: {
    key: "prediction_engine",
    name: "Prediction Engine",
    description: "Forecasting and prediction intelligence.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth — upgrade to unlock predictions.",
    documentationPath: "/docs/FEATURE_MATRIX.md#prediction-engine",
  },
  experiment_engine: {
    key: "experiment_engine",
    name: "Experiment Intelligence",
    description: "Experiment design and outcome tracking.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth — upgrade to run experiments.",
    documentationPath: "/docs/FEATURE_MATRIX.md#experiment-engine",
  },
  merchant_intelligence: {
    key: "merchant_intelligence",
    name: "Merchant Intelligence",
    description: "Merchant behavior and personalization intelligence.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth — upgrade for merchant intelligence.",
    documentationPath: "/docs/FEATURE_MATRIX.md#merchant-intelligence",
  },
  business_stability: {
    key: "business_stability",
    name: "Business Stability",
    description: "Business stability scoring.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth.",
    documentationPath: "/docs/FEATURE_MATRIX.md#business-stability",
  },
  adaptive_learning: {
    key: "adaptive_learning",
    name: "Adaptive Intelligence",
    description: "Adaptive learning and confidence evolution.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth.",
    documentationPath: "/docs/FEATURE_MATRIX.md#adaptive-learning",
  },
  prediction_workspace: {
    key: "prediction_workspace",
    name: "Prediction Workspace",
    description: "Dedicated prediction workspace UI.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth — upgrade to open Predictions.",
    documentationPath: "/docs/FEATURE_MATRIX.md#prediction-workspace",
  },
  experiment_workspace: {
    key: "experiment_workspace",
    name: "Experiment Workspace",
    description: "Dedicated experiment workspace UI.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth — upgrade to open Experiments.",
    documentationPath: "/docs/FEATURE_MATRIX.md#experiment-workspace",
  },
  priority_worker: {
    key: "priority_worker",
    name: "Priority Worker",
    description: "Priority background worker queue.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth — faster sync and workers.",
    documentationPath: "/docs/LIMIT_MATRIX.md#priority-worker",
  },
  priority_support: {
    key: "priority_support",
    name: "Priority Support",
    description: "Priority merchant support.",
    minimumPlan: "growth",
    upgradeText: "Available on Growth.",
    documentationPath: "/docs/FEATURE_MATRIX.md#priority-support",
  },
  priority_ai: {
    key: "priority_ai",
    name: "Priority AI",
    description: "Priority AI routing and higher throughput.",
    minimumPlan: "scale",
    upgradeText: "Available on Scale — upgrade for priority AI.",
    documentationPath: "/docs/FEATURE_MATRIX.md#priority-ai",
  },
  api_access: {
    key: "api_access",
    name: "API Access",
    description: "Programmatic API access.",
    minimumPlan: "scale",
    upgradeText: "Available on Scale — upgrade for API access.",
    documentationPath: "/docs/FEATURE_MATRIX.md#api-access",
  },
  white_glove: {
    key: "white_glove",
    name: "White-glove Onboarding",
    description: "Dedicated onboarding assistance.",
    minimumPlan: "scale",
    upgradeText: "Available on Scale.",
    documentationPath: "/docs/FEATURE_MATRIX.md#white-glove",
  },
  beta_features: {
    key: "beta_features",
    name: "Future Beta Features",
    description: "Early access to beta capabilities.",
    minimumPlan: "scale",
    upgradeText: "Available on Scale.",
    documentationPath: "/docs/FEATURE_MATRIX.md#beta-features",
  },
};

export function comparePlanRank(left: BillingPlanSlug, right: BillingPlanSlug): number {
  return PUBLIC_PLAN_SLUGS.indexOf(left) - PUBLIC_PLAN_SLUGS.indexOf(right);
}

function buildFeaturesForPlan(planSlug: BillingPlanSlug): Record<FeatureKey, boolean> {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [
      key,
      comparePlanRank(planSlug, FEATURE_REGISTRY[key].minimumPlan) >= 0,
    ]),
  ) as Record<FeatureKey, boolean>;
}

export const PLAN_REGISTRY: Record<BillingPlanSlug, PlanRegistryEntry> = {
  starter: {
    slug: "starter",
    name: "Starter",
    monthlyPriceUsd: 29,
    annualPriceUsd: 290,
    description: "Designed for new Shopify stores.",
    trialDays: GLOBAL_TRIAL_DAYS,
    primaryPlan: false,
    workerQueueTier: "standard",
    features: buildFeaturesForPlan("starter"),
    limits: {
      products: 5_000,
      users: 1,
      stores: 1,
      ai_requests: 500,
      executive_briefings: 50,
      predictions: 0,
      experiments: 0,
      knowledge_graph_nodes: 10_000,
      workers: 1,
      storage_mb: 1_024,
      api_requests: 0,
      sync_frequency_hours: 24,
      background_jobs: 100,
      connectors: 1,
      exports: 2,
      reports: 4,
      automations: 10,
    },
  },
  growth: {
    slug: "growth",
    name: "Growth",
    monthlyPriceUsd: 79,
    annualPriceUsd: 790,
    description: "For growing merchants who need prediction and experiment intelligence.",
    trialDays: GLOBAL_TRIAL_DAYS,
    primaryPlan: true,
    workerQueueTier: "normal",
    features: buildFeaturesForPlan("growth"),
    limits: {
      products: 50_000,
      users: 5,
      stores: 1,
      ai_requests: 5_000,
      executive_briefings: "unlimited",
      predictions: 500,
      experiments: 100,
      knowledge_graph_nodes: 100_000,
      workers: 3,
      storage_mb: 10_240,
      api_requests: 0,
      sync_frequency_hours: 1,
      background_jobs: 1_000,
      connectors: 4,
      exports: 20,
      reports: 52,
      automations: 100,
    },
  },
  scale: {
    slug: "scale",
    name: "Scale",
    monthlyPriceUsd: 199,
    annualPriceUsd: 1_990,
    description: "For high-volume merchants who need unlimited intelligence capacity.",
    trialDays: GLOBAL_TRIAL_DAYS,
    primaryPlan: false,
    workerQueueTier: "priority",
    features: buildFeaturesForPlan("scale"),
    limits: {
      products: "unlimited",
      users: "unlimited",
      stores: "unlimited",
      ai_requests: "unlimited",
      executive_briefings: "unlimited",
      predictions: "unlimited",
      experiments: "unlimited",
      knowledge_graph_nodes: "unlimited",
      workers: "unlimited",
      storage_mb: "unlimited",
      api_requests: "unlimited",
      sync_frequency_hours: 1,
      background_jobs: "unlimited",
      connectors: "unlimited",
      exports: "unlimited",
      reports: "unlimited",
      automations: "unlimited",
    },
  },
};

export function normalizePlanSlug(slug: string | null | undefined): BillingPlanSlug {
  if (!slug) {
    return "starter";
  }
  const normalized = slug.trim().toLowerCase();
  if (normalized in LEGACY_PLAN_SLUG_MAP) {
    return LEGACY_PLAN_SLUG_MAP[normalized]!;
  }
  if (PUBLIC_PLAN_SLUGS.includes(normalized as BillingPlanSlug)) {
    return normalized as BillingPlanSlug;
  }
  return "starter";
}

export function getPlanEntry(slug: string | BillingPlanSlug): PlanRegistryEntry {
  return PLAN_REGISTRY[normalizePlanSlug(slug)];
}

export function listPublicPlans(): PlanRegistryEntry[] {
  return PUBLIC_PLAN_SLUGS.map((slug) => PLAN_REGISTRY[slug]);
}

export function getFeatureRegistry(): FeatureRegistryEntry[] {
  return FEATURE_KEYS.map((key) => FEATURE_REGISTRY[key]);
}

export function getFeatureDefinition(feature: FeatureKey): FeatureRegistryEntry {
  return FEATURE_REGISTRY[feature];
}

export function isUnlimitedLimit(value: PlanLimitValue): boolean {
  return value === "unlimited";
}

export function resolveLimitValue(value: PlanLimitValue): number {
  return value === "unlimited" ? Number.MAX_SAFE_INTEGER : value;
}

/** Max INT4 value for PostgreSQL plan columns when persisting "unlimited". */
export const DB_UNLIMITED_INT = 2_147_483_647;

export function resolveLimitValueForDb(value: PlanLimitValue): number {
  return Math.min(resolveLimitValue(value), DB_UNLIMITED_INT);
}

export function getPlanLimit(slug: string | BillingPlanSlug, limit: LimitKey): PlanLimitValue {
  return getPlanEntry(slug).limits[limit];
}

export function getResolvedPlanLimit(slug: string | BillingPlanSlug, limit: LimitKey): number {
  return resolveLimitValue(getPlanLimit(slug, limit));
}

export function isFeatureAvailable(
  planSlug: string | BillingPlanSlug,
  feature: FeatureKey,
): boolean {
  const plan = getPlanEntry(planSlug);
  return plan.features[feature] === true;
}

export type FeatureAvailability = {
  available: boolean;
  feature: FeatureKey;
  featureName: string;
  currentPlan: BillingPlanSlug;
  currentPlanName: string;
  minimumPlan: BillingPlanSlug;
  minimumPlanName: string;
  upgradeText: string;
  documentationPath: string;
  upgradeTargetPlan: BillingPlanSlug | null;
  upgradePriceUsd: number | null;
};

export function getFeatureAvailability(
  planSlug: string | BillingPlanSlug,
  feature: FeatureKey,
): FeatureAvailability {
  const normalized = normalizePlanSlug(planSlug);
  const definition = FEATURE_REGISTRY[feature];
  const available = isFeatureAvailable(normalized, feature);
  const minimumPlan = definition.minimumPlan;
  const upgradeTarget = available ? null : minimumPlan;

  return {
    available,
    feature,
    featureName: definition.name,
    currentPlan: normalized,
    currentPlanName: PLAN_REGISTRY[normalized].name,
    minimumPlan,
    minimumPlanName: PLAN_REGISTRY[minimumPlan].name,
    upgradeText: definition.upgradeText,
    documentationPath: definition.documentationPath,
    upgradeTargetPlan: upgradeTarget,
    upgradePriceUsd: upgradeTarget ? PLAN_REGISTRY[upgradeTarget].monthlyPriceUsd : null,
  };
}

export function getWorkerQueueTier(planSlug: string | BillingPlanSlug): WorkerQueueTier {
  return getPlanEntry(planSlug).workerQueueTier;
}

export function resolveUpgradeTarget(current: BillingPlanSlug): BillingPlanSlug | null {
  const index = PUBLIC_PLAN_SLUGS.indexOf(current);
  return index < PUBLIC_PLAN_SLUGS.length - 1 ? PUBLIC_PLAN_SLUGS[index + 1]! : null;
}

export function resolveDowngradeTarget(current: BillingPlanSlug): BillingPlanSlug | null {
  const index = PUBLIC_PLAN_SLUGS.indexOf(current);
  return index > 0 ? PUBLIC_PLAN_SLUGS[index - 1]! : null;
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
  return listPublicPlans().map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: plan.monthlyPriceUsd,
    annualPrice: plan.annualPriceUsd,
    maxProducts: resolveLimitValueForDb(plan.limits.products),
    maxOrders: resolveLimitValueForDb(plan.limits.products),
    maxTeamMembers: resolveLimitValueForDb(plan.limits.users),
    aiCreditsPerMonth: resolveLimitValueForDb(plan.limits.ai_requests),
    active: true,
  }));
}

/** Website-safe pricing export — no hardcoded prices outside registry. */
export function buildWebsitePricingModel() {
  return {
    generatedAt: new Date().toISOString(),
    trialDays: GLOBAL_TRIAL_DAYS,
    primaryPlanSlug: PRIMARY_BILLING_PLAN_SLUG,
    plans: listPublicPlans().map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      monthlyPriceUsd: plan.monthlyPriceUsd,
      annualPriceUsd: plan.annualPriceUsd,
      description: plan.description,
      primaryPlan: plan.primaryPlan,
      features: FEATURE_KEYS.filter((key) => plan.features[key]).map((key) => ({
        key,
        name: FEATURE_REGISTRY[key].name,
        description: FEATURE_REGISTRY[key].description,
      })),
      limits: plan.limits,
    })),
    featureRegistry: getFeatureRegistry(),
  };
}
