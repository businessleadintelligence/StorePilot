import prisma from "../db.server";
import { getClarityIntegrationPublicView } from "../services/clarity-integration.server";
import { getGoogleIntegrationPublicView } from "../services/google-integration.server";
import { getOnboardingStatus } from "../services/onboarding-ui.server";
import { getStoreSyncStatus } from "../services/sync-status.server";
import type { MerchantOnboardingRecord, OnboardingStepId, OnboardingStepStatus } from "./onboarding-types";

export type OnboardingCheckContext = {
  storeId: string;
  record: MerchantOnboardingRecord;
};

export type OnboardingStepCheckResult = {
  status: OnboardingStepStatus;
  healthLabel: "Healthy" | "Needs Attention" | "Critical" | "Ready" | "Skipped" | null;
  summary: string | null;
  warning: string | null;
  details: Record<string, string | number | boolean | null>;
  autoComplete: boolean;
};

export async function checkOnboardingStep(
  stepId: OnboardingStepId,
  context: OnboardingCheckContext,
): Promise<OnboardingStepCheckResult> {
  if (context.record.skippedStepIds.includes(stepId)) {
    return skippedResult(stepId);
  }

  if (context.record.completedStepIds.includes(stepId)) {
    return completedResult("Previously completed");
  }

  switch (stepId) {
    case "welcome":
      return checkWelcomeStep(context);
    case "shopify":
      return checkShopifyStep(context.storeId);
    case "google":
      return checkGoogleStep(context.storeId);
    case "ga4":
      return checkGa4Step(context.storeId);
    case "search_console":
      return checkSearchConsoleStep(context.storeId);
    case "pagespeed":
      return checkPageSpeedStep(context.storeId);
    case "clarity":
      return checkClarityStep(context.storeId);
    case "shopify_sync":
      return checkShopifySyncStep(context.storeId);
    case "ai_init":
      return checkAiInitStep(context.record);
    case "executive_briefing":
      return checkExecutiveBriefingStep(context.record);
    default:
      return pendingResult();
  }
}

function skippedResult(stepId: OnboardingStepId): OnboardingStepCheckResult {
  const warning =
    stepId === "google"
      ? "Traffic insights and SEO accuracy will be limited until Google is connected."
      : stepId === "ga4"
        ? "Google Analytics is not connected. Revenue Growth Intelligence accuracy is reduced."
        : null;

  return {
    status: "skipped",
    healthLabel: "Skipped",
    summary: "Skipped during onboarding",
    warning,
    details: { skipped: true },
    autoComplete: true,
  };
}

function completedResult(summary: string): OnboardingStepCheckResult {
  return {
    status: "completed",
    healthLabel: "Ready",
    summary,
    warning: null,
    details: {},
    autoComplete: true,
  };
}

function pendingResult(): OnboardingStepCheckResult {
  return {
    status: "pending",
    healthLabel: null,
    summary: null,
    warning: null,
    details: {},
    autoComplete: false,
  };
}

function checkWelcomeStep(context: OnboardingCheckContext): OnboardingStepCheckResult {
  if (context.record.welcomeCompletedAt) {
    return completedResult("Welcome completed");
  }

  return {
    status: "in_progress",
    healthLabel: null,
    summary: "Estimated setup time: 3–5 minutes",
    warning: null,
    details: {
      privacyByArchitecture: true,
      merchantApprovalRequired: true,
      noCustomerProfiling: true,
    },
    autoComplete: false,
  };
}

async function checkShopifyStep(storeId: string): Promise<OnboardingStepCheckResult> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { active: true },
  });

  const level = store?.active ? "Healthy" : "Needs Attention";
  return {
    status: store?.active ? "completed" : "in_progress",
    healthLabel: level,
    summary: store?.active ? "Store connected with permissions granted" : "Verify Shopify connection",
    warning: null,
    details: {
      connected: store?.active ?? false,
      webhooksReady: store?.active ?? false,
      syncReady: store?.active ?? false,
    },
    autoComplete: Boolean(store?.active),
  };
}

async function checkGoogleStep(storeId: string): Promise<OnboardingStepCheckResult> {
  const google = await getGoogleIntegrationPublicView(storeId);
  return {
    status: google.connected ? "completed" : "in_progress",
    healthLabel: google.connected ? "Healthy" : "Needs Attention",
    summary: google.connected ? "Google account connected" : "Connect Google to unlock traffic insights",
    warning: google.connected
      ? null
      : "Traffic insights and SEO accuracy will be limited until Google is connected.",
    details: {
      connected: google.connected,
      configured: google.configured,
    },
    autoComplete: google.connected,
  };
}

async function checkGa4Step(storeId: string): Promise<OnboardingStepCheckResult> {
  const google = await getGoogleIntegrationPublicView(storeId);
  const ready = google.connected && !google.needsPropertySelection && Boolean(google.lastSyncAt);

  return {
    status: ready ? "completed" : google.googleAnalyticsSkipped ? "skipped" : "in_progress",
    healthLabel: ready ? "Ready" : "Needs Attention",
    summary: ready
      ? `Last sync: ${google.lastSyncAt}`
      : google.needsPropertySelection
        ? "Select a GA4 property"
        : "Connect and sync Google Analytics",
    warning: ready ? null : "Traffic insights will remain limited without GA4.",
    details: {
      connected: google.connected,
      lastSyncAt: google.lastSyncAt,
      trafficDetected: ready,
    },
    autoComplete: ready,
  };
}

async function checkSearchConsoleStep(storeId: string): Promise<OnboardingStepCheckResult> {
  const google = await getGoogleIntegrationPublicView(storeId);
  const ready = Boolean(google.searchConsoleSiteUrl && google.searchConsoleLastSyncAt);

  return {
    status: ready ? "completed" : "in_progress",
    healthLabel: ready ? "Ready" : "Needs Attention",
    summary: ready ? "Search visibility data synced" : "Select Search Console property",
    warning: ready ? null : "SEO visibility metrics will be limited.",
    details: {
      siteUrl: google.searchConsoleSiteUrl,
      lastSyncAt: google.searchConsoleLastSyncAt,
    },
    autoComplete: ready,
  };
}

async function checkPageSpeedStep(storeId: string): Promise<OnboardingStepCheckResult> {
  const google = await getGoogleIntegrationPublicView(storeId);
  const ready = google.pageSpeedAvailable && Boolean(google.pageSpeedLastSyncAt);

  return {
    status: ready ? "completed" : "in_progress",
    healthLabel: ready ? "Ready" : "Needs Attention",
    summary: ready ? "Performance analysis complete" : "Run first PageSpeed analysis",
    warning: ready ? null : "Core Web Vitals will be unavailable.",
    details: {
      available: google.pageSpeedAvailable,
      lastSyncAt: google.pageSpeedLastSyncAt,
    },
    autoComplete: ready,
  };
}

async function checkClarityStep(storeId: string): Promise<OnboardingStepCheckResult> {
  const clarity = await getClarityIntegrationPublicView(storeId);
  const ready = clarity.connected && Boolean(clarity.lastSyncAt);

  return {
    status: ready ? "completed" : "in_progress",
    healthLabel: ready ? "Ready" : "Needs Attention",
    summary: ready ? "Behavior data available" : "Connect Microsoft Clarity",
    warning: ready ? null : "UX behavior metrics will be limited.",
    details: {
      connected: clarity.connected,
      lastSyncAt: clarity.lastSyncAt,
    },
    autoComplete: ready,
  };
}

async function checkShopifySyncStep(storeId: string): Promise<OnboardingStepCheckResult> {
  const [syncStatus, onboarding] = await Promise.all([
    getStoreSyncStatus(storeId),
    getOnboardingStatus(storeId),
  ]);

  const productsDone =
    syncStatus.products.synced || onboarding?.productSyncStatus === "completed";
  const inventoryDone =
    syncStatus.inventory.synced || onboarding?.inventorySyncStatus === "completed";
  const ordersDone =
    syncStatus.orders.synced ||
    onboarding?.ordersSyncStatus === "completed" ||
    onboarding?.ordersSyncStatus === "blocked";

  const imported =
    syncStatus.products.count + syncStatus.inventory.count + syncStatus.orders.count;
  const complete = productsDone && inventoryDone;

  return {
    status: complete ? "completed" : onboarding?.status === "failed" ? "blocked" : "in_progress",
    healthLabel: complete ? "Ready" : "Needs Attention",
    summary: complete
      ? `${imported} items imported`
      : onboarding?.progressLabel ?? "Initial sync in progress",
    warning: onboarding?.ordersSyncStatus === "blocked" ? onboarding.blockedMessage ?? null : null,
    details: {
      productsSynced: productsDone,
      inventorySynced: inventoryDone,
      ordersSynced: ordersDone,
      itemsImported: imported,
      progressPercent: onboarding?.progressPercent ?? 0,
    },
    autoComplete: complete,
  };
}

function checkAiInitStep(record: MerchantOnboardingRecord): OnboardingStepCheckResult {
  const ai = record.aiInitialization;
  if (ai.status === "completed") {
    return completedResult(`${ai.completedAgents.length} agents initialized`);
  }

  if (ai.status === "running") {
    return {
      status: "in_progress",
      healthLabel: null,
      summary: ai.currentAgentId ? `Running ${ai.currentAgentId}` : "Initializing AI specialists",
      warning: null,
      details: {
        completedAgents: ai.completedAgents.length,
        failedAgents: ai.failedAgents.length,
      },
      autoComplete: false,
    };
  }

  if (ai.status === "failed") {
    return {
      status: "blocked",
      healthLabel: "Needs Attention",
      summary: "Some agents failed to initialize",
      warning: ai.lastError,
      details: { failedAgents: ai.failedAgents.length },
      autoComplete: false,
    };
  }

  return {
    status: "pending",
    healthLabel: null,
    summary: "Run specialist agents on synced store data",
    warning: null,
    details: {},
    autoComplete: false,
  };
}

function checkExecutiveBriefingStep(record: MerchantOnboardingRecord): OnboardingStepCheckResult {
  if (record.activated) {
    return completedResult("StorePilot activated");
  }

  if (record.aiInitialization.status !== "completed") {
    return {
      status: "pending",
      healthLabel: null,
      summary: "Complete AI initialization first",
      warning: null,
      details: {},
      autoComplete: false,
    };
  }

  return {
    status: "in_progress",
    healthLabel: null,
    summary: "Review your first executive briefing",
    warning: null,
    details: {},
    autoComplete: false,
  };
}

export async function checkAllOnboardingSteps(
  context: OnboardingCheckContext,
): Promise<Record<OnboardingStepId, OnboardingStepCheckResult>> {
  const entries = await Promise.all(
    ([
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
    ] as const).map(async (stepId) => [stepId, await checkOnboardingStep(stepId, context)] as const),
  );

  return Object.fromEntries(entries) as Record<OnboardingStepId, OnboardingStepCheckResult>;
}
