import { buildOnboardingBillingSummary } from "../billing/billing-onboarding";
import prisma from "../db.server";
import { createInMemoryAutomationPersistence } from "../automation/automation-persistence";
import { getAutomationCenterData } from "../services/automation.server";
import { getClarityIntegrationPublicView } from "../services/clarity-integration.server";
import { getGoogleIntegrationPublicView } from "../services/google-integration.server";
import { getStoreMetrics } from "../services/metrics.server";
import { getOnboardingStatus } from "../services/onboarding-ui.server";
import { getStoreSyncStatus } from "../services/sync-status.server";
import { getProductionHealthBadge } from "../production/production-service";
import { checkAllOnboardingSteps } from "./onboarding-checks";
import { computeOnboardingProgress, findStepDefinition } from "./onboarding-progress";
import { buildOnboardingReminders } from "./onboarding-recommendations";
import { getOrCreateMerchantOnboardingState } from "./onboarding-state";
import {
  createInMemoryOnboardingPersistence,
  type OnboardingPersistence,
} from "./onboarding-persistence";
import type {
  ActivationScoreBreakdown,
  MerchantOnboardingRecord,
  OnboardingDashboardData,
  OnboardingDemoSnapshot,
  OnboardingExecutiveBriefing,
  OnboardingStepView,
} from "./onboarding-types";
import { ONBOARDING_STEP_IDS } from "./onboarding-types";

const defaultPersistence = createInMemoryOnboardingPersistence();
const automationPersistence = createInMemoryAutomationPersistence();

export const DEMO_ONBOARDING_SNAPSHOT: OnboardingDemoSnapshot = {
  products: 42,
  orders: 128,
  grossRevenue: 24850,
  healthScore: 82,
  trafficSessions: 1240,
  searchClicks: 386,
  performanceScore: 74,
};

export async function buildOnboardingDashboard(input: {
  storeId: string;
  persistence?: OnboardingPersistence;
}): Promise<OnboardingDashboardData> {
  const startedAt = Date.now();
  const persistence = input.persistence ?? defaultPersistence;

  const record = await getOrCreateMerchantOnboardingState(input.storeId, persistence);
  const stepChecks = await checkAllOnboardingSteps({ storeId: input.storeId, record });
  const progress = computeOnboardingProgress({
    record,
    stepStatuses: Object.fromEntries(
      Object.entries(stepChecks).map(([stepId, result]) => [stepId, result]),
    ),
  });

  const [activationScore, reminders, emptyStates, executiveBriefing] = await Promise.all([
    computeActivationScore(input.storeId, record),
    buildOnboardingReminders(input.storeId),
    computeEmptyStates(input.storeId),
    buildExecutiveBriefing(input.storeId, record),
  ]);

  const steps: OnboardingStepView[] = ONBOARDING_STEP_IDS.map((stepId) => {
    const definition = findStepDefinition(stepId);
    const check = stepChecks[stepId];
    return {
      id: stepId,
      label: definition.label,
      description: definition.description,
      status: check.status,
      required: definition.required,
      skippable: definition.skippable,
      estimatedMinutes: definition.estimatedMinutes,
      healthLabel: check.healthLabel,
      summary: check.summary,
      warning: check.warning,
      details: check.details,
    };
  });

  return {
    storeId: input.storeId,
    computedAt: new Date().toISOString(),
    aggregationDurationMs: Date.now() - startedAt,
    demoMode: record.demoMode,
    activated: record.activated,
    currentStepId: record.currentStepId,
    progress,
    activationScore,
    steps,
    reminders,
    executiveBriefing,
    demoSnapshot: record.demoMode ? DEMO_ONBOARDING_SNAPSHOT : null,
    emptyStates,
    billingSummary: buildOnboardingBillingSummary(),
  };
}

async function computeActivationScore(
  storeId: string,
  record: MerchantOnboardingRecord,
): Promise<ActivationScoreBreakdown> {
  const [store, google, syncStatus, healthBadge, automationCenter] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { active: true } }),
    getGoogleIntegrationPublicView(storeId),
    getStoreSyncStatus(storeId),
    getProductionHealthBadge(storeId),
    getAutomationCenterData({ storeId, persistence: automationPersistence, syncFromOperations: false }),
  ]);

  const factors = {
    shopifyConnected: Boolean(store?.active),
    googleConnected: google.connected,
    productsSynced: syncStatus.products.synced,
    ordersSynced: syncStatus.orders.synced || syncStatus.orders.blocked,
    aiInitialized: record.aiInitialization.status === "completed",
    executiveCooCompleted: record.aiInitialization.completedAgents.includes("executive_coo"),
    automationReady: automationCenter.metrics.automationsPrepared > 0 || automationCenter.metrics.executionRate > 0,
    systemHealthy: healthBadge.label === "Healthy",
  };

  const weights = Object.values(factors).filter(Boolean).length;
  const score = Math.round((weights / 8) * 100);

  return { score, ...factors };
}

async function computeEmptyStates(storeId: string) {
  const [metrics, google, clarity, aiRuns, automationCenter] = await Promise.all([
    getStoreMetrics(storeId),
    getGoogleIntegrationPublicView(storeId),
    getClarityIntegrationPublicView(storeId),
    prisma.aiAgentRun.count({ where: { storeId } }),
    getAutomationCenterData({ storeId, persistence: automationPersistence, syncFromOperations: false }),
  ]);

  return {
    noProducts: metrics.products === 0,
    noOrders: metrics.orders === 0,
    noConnectors: !google.connected && !clarity.connected,
    noAiRuns: aiRuns === 0,
    noAutomations: automationCenter.automationQueue.length === 0,
    noOperations: automationCenter.metrics.operationsAutomated === 0,
  };
}

async function buildExecutiveBriefing(
  storeId: string,
  record: MerchantOnboardingRecord,
): Promise<OnboardingExecutiveBriefing | null> {
  if (record.aiInitialization.status !== "completed" && !record.demoMode) {
    return null;
  }

  const [metrics, syncStatus, onboarding, healthBadge] = await Promise.all([
    getStoreMetrics(storeId),
    getStoreSyncStatus(storeId),
    getOnboardingStatus(storeId),
    getProductionHealthBadge(storeId),
  ]);

  const demo = record.demoMode ? DEMO_ONBOARDING_SNAPSHOT : null;
  const productCount = demo?.products ?? metrics.products;
  const orderCount = demo?.orders ?? metrics.orders;
  const healthScore = demo?.healthScore ?? Math.max(50, 100 - (onboarding?.progressPercent ? 100 - onboarding.progressPercent : 20));

  return {
    businessHealth:
      healthScore >= 80
        ? "Your store foundation is healthy and ready for daily intelligence."
        : "Your store is operational with opportunities to improve data coverage.",
    topPriorities: [
      productCount > 0 ? "Review product intelligence recommendations" : "Complete product sync",
      orderCount > 0 ? "Validate revenue growth opportunities" : "Enable order sync when approved",
      "Review automation-ready recommendations in Command Center",
    ],
    quickWins: [
      "Connect remaining optional integrations from Settings",
      "Approve your first low-risk automation",
      "Review today's executive priorities",
    ],
    expectedRevenueOpportunity: demo
      ? "$4,200 identified in demo analysis"
      : orderCount > 0
        ? "Revenue opportunities will populate as agents complete analysis"
        : "Connect orders to unlock revenue opportunity estimates",
    automationReady: record.aiInitialization.completedAgents.length >= 3,
    systemHealthLabel: healthBadge.label,
    celebrationMessage: record.activated
      ? "StorePilot is activated. Your first executive briefing is ready."
      : "You're ready for your first executive briefing.",
  };
}

export function serializeOnboardingDashboardForLoader(
  dashboard: OnboardingDashboardData,
): OnboardingDashboardData {
  return JSON.parse(JSON.stringify(dashboard)) as OnboardingDashboardData;
}

export { defaultPersistence as onboardingDashboardPersistence };
