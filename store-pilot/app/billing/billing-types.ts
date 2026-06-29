export const BILLING_PLAN_SLUGS = ["starter", "growth", "pro", "agency"] as const;

export type BillingPlanSlug = (typeof BILLING_PLAN_SLUGS)[number];

export const COMMERCIAL_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "paused",
  "cancelled",
  "expired",
  "past_due",
  "frozen",
  "pending",
  "scheduled_cancellation",
] as const;

export type CommercialSubscriptionStatus = (typeof COMMERCIAL_SUBSCRIPTION_STATUSES)[number];

export type BillingAction =
  | "ai_execution"
  | "automation_create"
  | "automation_execute"
  | "connector_sync"
  | "operations_create"
  | "api_request"
  | "background_job"
  | "data_export";

export type BillingPlanDefinition = {
  slug: BillingPlanSlug;
  name: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  description: string;
  maxStores: number;
  aiExecutionsPerMonth: number;
  automationExecutionsPerMonth: number;
  connectorSyncsPerMonth: number;
  operationsPerMonth: number;
  apiRequestsPerMonth: number;
  backgroundJobsPerMonth: number;
  dataExportsPerMonth: number;
  maxProducts: number;
  maxOrders: number;
  maxTeamMembers: number;
  syncFrequencyHours: number;
  connectors: Array<"ga4" | "gsc" | "pagespeed" | "clarity">;
  connectorMode: "single_optional" | "all";
  executiveCooAccess: "limited" | "full" | "advanced";
  operationsCenterEnabled: boolean;
  automationCenterEnabled: boolean;
  productionHealthAlerts: "basic" | "standard" | "advanced";
  multiStoreAnalytics: boolean;
  agencyFeatures: boolean;
  primaryPlan?: boolean;
};

export type BillingUsageSnapshot = {
  storeId: string;
  month: string;
  aiExecutions: number;
  automationExecutions: number;
  connectorSyncs: number;
  operationsCreated: number;
  apiRequests: number;
  backgroundJobs: number;
  dataExports: number;
  storageMb: number;
};

export type BillingLimitCheckResult = {
  allowed: boolean;
  action: BillingAction;
  used: number;
  limit: number;
  remaining: number;
  upgradeMessage: string | null;
  reason: string | null;
};

export type BillingTrialStatus = {
  active: boolean;
  trialStart: string | null;
  trialEnd: string | null;
  remainingDays: number;
  expired: boolean;
  upgradePrompt: string | null;
};

export type BillingNotification = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  actionLabel: string | null;
  actionHref: string | null;
};

export type BillingAuditEvent = {
  id: string;
  storeId: string;
  eventType: string;
  message: string;
  createdAt: string;
};

export type BillingDashboardData = {
  storeId: string;
  computedAt: string;
  aggregationDurationMs: number;
  currentPlan: BillingPlanDefinition;
  commercialStatus: CommercialSubscriptionStatus;
  trial: BillingTrialStatus;
  usage: BillingUsageSnapshot;
  limits: BillingPlanDefinition;
  usageChecks: Record<BillingAction, BillingLimitCheckResult>;
  notifications: BillingNotification[];
  upgradeRecommendations: string[];
  plans: BillingPlanDefinition[];
  canUpgrade: boolean;
  canDowngrade: boolean;
  canCancel: boolean;
  historyPlaceholder: boolean;
  invoicesPlaceholder: boolean;
};

export type BillingActionResult = {
  ok: boolean;
  error?: string;
  redirectTo?: string;
  message?: string;
};

export type BillingPlanSummary = {
  slug: BillingPlanSlug;
  name: string;
  priceUsd: number;
  trialDays: number;
  description: string;
  features: string[];
};

export type OnboardingBillingSummary = {
  trialDays: number;
  trialExplanation: string;
  upgradeMessage: string;
  plans: BillingPlanSummary[];
};
