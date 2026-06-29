export const ONBOARDING_STEP_IDS = [
  "welcome",
  "shopify",
  "google",
  "ga4",
  "search_console",
  "pagespeed",
  "clarity",
  "shopify_sync",
  "ai_init",
  "executive_briefing",
] as const;

import type { OnboardingBillingSummary } from "../billing/billing-types";

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export const ONBOARDING_LIFECYCLE_STAGES = [
  "installed",
  "connected",
  "configured",
  "synced",
  "analyzed",
  "activated",
  "active",
] as const;

export type OnboardingLifecycleStage = (typeof ONBOARDING_LIFECYCLE_STAGES)[number];

export type OnboardingStepStatus = "pending" | "in_progress" | "completed" | "skipped" | "blocked";

export type OnboardingStepDefinition = {
  id: OnboardingStepId;
  label: string;
  description: string;
  required: boolean;
  skippable: boolean;
  estimatedMinutes: number;
};

export type MerchantOnboardingRecord = {
  storeId: string;
  currentStepId: OnboardingStepId;
  completedStepIds: OnboardingStepId[];
  skippedStepIds: OnboardingStepId[];
  demoMode: boolean;
  activated: boolean;
  activatedAt: string | null;
  welcomeCompletedAt: string | null;
  aiInitialization: OnboardingAiInitializationState;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingAiInitializationState = {
  status: "idle" | "running" | "completed" | "failed";
  completedAgents: string[];
  failedAgents: string[];
  currentAgentId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
};

export type OnboardingStepView = {
  id: OnboardingStepId;
  label: string;
  description: string;
  status: OnboardingStepStatus;
  required: boolean;
  skippable: boolean;
  estimatedMinutes: number;
  healthLabel: "Healthy" | "Needs Attention" | "Critical" | "Ready" | "Skipped" | null;
  summary: string | null;
  warning: string | null;
  details: Record<string, string | number | boolean | null>;
};

export type OnboardingProgress = {
  completionPercent: number;
  remainingSteps: number;
  estimatedMinutesRemaining: number;
  recommendedNextAction: string;
  blockedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  lifecycleStage: OnboardingLifecycleStage;
};

export type ActivationScoreBreakdown = {
  score: number;
  shopifyConnected: boolean;
  googleConnected: boolean;
  productsSynced: boolean;
  ordersSynced: boolean;
  aiInitialized: boolean;
  executiveCooCompleted: boolean;
  automationReady: boolean;
  systemHealthy: boolean;
};

export type OnboardingReminder = {
  id: string;
  severity: "info" | "warning";
  message: string;
  href: string;
  connectorId: string | null;
};

export type OnboardingExecutiveBriefing = {
  businessHealth: string;
  topPriorities: string[];
  quickWins: string[];
  expectedRevenueOpportunity: string;
  automationReady: boolean;
  systemHealthLabel: string;
  celebrationMessage: string;
};

export type OnboardingDemoSnapshot = {
  products: number;
  orders: number;
  grossRevenue: number;
  healthScore: number;
  trafficSessions: number;
  searchClicks: number;
  performanceScore: number;
};

export type OnboardingDashboardData = {
  storeId: string;
  computedAt: string;
  aggregationDurationMs: number;
  demoMode: boolean;
  activated: boolean;
  currentStepId: OnboardingStepId;
  progress: OnboardingProgress;
  activationScore: ActivationScoreBreakdown;
  steps: OnboardingStepView[];
  reminders: OnboardingReminder[];
  executiveBriefing: OnboardingExecutiveBriefing | null;
  demoSnapshot: OnboardingDemoSnapshot | null;
  emptyStates: {
    noProducts: boolean;
    noOrders: boolean;
    noConnectors: boolean;
    noAiRuns: boolean;
    noAutomations: boolean;
    noOperations: boolean;
  };
  billingSummary: OnboardingBillingSummary;
};

export const ONBOARDING_STEP_DEFINITIONS: OnboardingStepDefinition[] = [
  {
    id: "welcome",
    label: "Welcome",
    description: "Learn what StorePilot does and how setup works.",
    required: true,
    skippable: false,
    estimatedMinutes: 1,
  },
  {
    id: "shopify",
    label: "Shopify Connection",
    description: "Verify store connection, permissions, and webhooks.",
    required: true,
    skippable: false,
    estimatedMinutes: 1,
  },
  {
    id: "google",
    label: "Google Connection",
    description: "Connect Google for traffic and SEO insights.",
    required: false,
    skippable: true,
    estimatedMinutes: 1,
  },
  {
    id: "ga4",
    label: "Google Analytics",
    description: "Select a GA4 property and run the first sync.",
    required: false,
    skippable: true,
    estimatedMinutes: 1,
  },
  {
    id: "search_console",
    label: "Search Console",
    description: "Select a property and verify search visibility.",
    required: false,
    skippable: true,
    estimatedMinutes: 1,
  },
  {
    id: "pagespeed",
    label: "PageSpeed Insights",
    description: "Run the first storefront performance analysis.",
    required: false,
    skippable: true,
    estimatedMinutes: 1,
  },
  {
    id: "clarity",
    label: "Microsoft Clarity",
    description: "Connect behavior analytics with project credentials.",
    required: false,
    skippable: true,
    estimatedMinutes: 1,
  },
  {
    id: "shopify_sync",
    label: "Initial Shopify Sync",
    description: "Import products, orders, inventory, and store metadata.",
    required: true,
    skippable: false,
    estimatedMinutes: 2,
  },
  {
    id: "ai_init",
    label: "AI Initialization",
    description: "Run specialist agents using your synced store data.",
    required: true,
    skippable: false,
    estimatedMinutes: 2,
  },
  {
    id: "executive_briefing",
    label: "First Executive Briefing",
    description: "Review your first business health summary.",
    required: true,
    skippable: false,
    estimatedMinutes: 1,
  },
];
