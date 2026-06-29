import prisma from "../db.server";
import { executeBundleDiscovery } from "../services/bundle-intelligence.server";
import { executeExecutiveCoo } from "../services/executive-coo.server";
import { executeGrowthIntelligence } from "../services/growth-intelligence.server";
import { executeInventoryIntelligence } from "../services/inventory-intelligence.server";
import { executePricingIntelligence } from "../services/pricing-intelligence.server";
import { executeProductIntelligence } from "../services/product-intelligence.server";
import { executeSeoIntelligence } from "../services/seo-intelligence.server";
import { executeStoreAudit } from "../services/store-audit.server";
import {
  beginGoogleOAuth,
  skipGoogleAnalyticsOnboarding,
  syncGoogleAnalyticsForStore,
  syncGooglePageSpeedForStore,
  syncGoogleSearchConsoleForStore,
} from "../services/google-integration.server";
import {
  connectMicrosoftClarityIntegration,
  syncMicrosoftClarityForStore,
} from "../services/clarity-integration.server";
import { advanceOnboarding, resumeOnboarding } from "../services/onboarding.server";
import {
  completeOnboardingStep,
  setDemoMode,
  skipOnboardingStep,
  updateAiInitializationState,
} from "./onboarding-state";
import { isOnboardingStepSkippable } from "./onboarding-progress";
import {
  createInMemoryOnboardingPersistence,
  type OnboardingPersistence,
} from "./onboarding-persistence";
import type { OnboardingStepId } from "./onboarding-types";

const defaultPersistence = createInMemoryOnboardingPersistence();

const ONBOARDING_AI_AGENTS = [
  { id: "product_intelligence", label: "Product Intelligence" },
  { id: "inventory_intelligence", label: "Inventory Intelligence" },
  { id: "bundle_discovery", label: "Bundle Discovery" },
  { id: "store_audit", label: "Store Audit" },
  { id: "seo_intelligence", label: "SEO Intelligence" },
  { id: "pricing_intelligence", label: "Pricing Strategy Intelligence" },
  { id: "growth_intelligence", label: "Revenue Growth Intelligence" },
  { id: "executive_coo", label: "Executive COO" },
] as const;

export type OnboardingActionResult = {
  ok: boolean;
  error?: string;
  redirectTo?: string;
};

export async function handleOnboardingAction(input: {
  storeId: string;
  shop: string;
  intent: string;
  stepId?: OnboardingStepId;
  formData?: FormData;
  persistence?: OnboardingPersistence;
}): Promise<OnboardingActionResult> {
  const persistence = input.persistence ?? defaultPersistence;
  const stepId = input.stepId;

  switch (input.intent) {
    case "complete-welcome":
      await completeOnboardingStep(input.storeId, "welcome", persistence);
      return { ok: true };

    case "advance-step":
      if (!stepId) return { ok: false, error: "missing_step" };
      await completeOnboardingStep(input.storeId, stepId, persistence);
      return { ok: true };

    case "skip-step":
      if (!stepId) return { ok: false, error: "missing_step" };
      if (!isOnboardingStepSkippable(stepId)) {
        return { ok: false, error: "step_not_skippable" };
      }
      if (stepId === "ga4") {
        await skipGoogleAnalyticsOnboarding(input.storeId);
      }
      await skipOnboardingStep(input.storeId, stepId, persistence);
      return { ok: true };

    case "enter-demo":
      await setDemoMode(input.storeId, true, persistence);
      return { ok: true };

    case "exit-demo":
      await setDemoMode(input.storeId, false, persistence);
      return { ok: true };

    case "begin-google-oauth": {
      const authorizationUrl = await beginGoogleOAuth({
        storeId: input.storeId,
        shop: input.shop,
      });
      return { ok: true, redirectTo: authorizationUrl };
    }

    case "skip-google-analytics":
      await skipGoogleAnalyticsOnboarding(input.storeId);
      await skipOnboardingStep(input.storeId, "ga4", persistence);
      return { ok: true };

    case "sync-ga4":
      await syncGoogleAnalyticsForStore(input.storeId);
      return { ok: true };

    case "sync-search-console":
      await syncGoogleSearchConsoleForStore(input.storeId);
      return { ok: true };

    case "sync-pagespeed":
      await syncGooglePageSpeedForStore(input.storeId);
      return { ok: true };

    case "connect-clarity": {
      const projectId = String(input.formData?.get("projectId") ?? "");
      const apiToken = String(input.formData?.get("apiToken") ?? "");
      const projectName = String(input.formData?.get("projectName") ?? "");
      if (!projectId || !apiToken) {
        return { ok: false, error: "missing_clarity_credentials" };
      }
      await connectMicrosoftClarityIntegration({
        storeId: input.storeId,
        projectId,
        apiToken,
        projectName: projectName || undefined,
      });
      return { ok: true };
    }

    case "sync-clarity":
      await syncMicrosoftClarityForStore(input.storeId);
      return { ok: true };

    case "retry-shopify-sync":
      await resumeOnboarding(input.storeId);
      await advanceOnboarding({ storeId: input.storeId });
      return { ok: true };

    case "run-ai-init":
      await runOnboardingAiInitialization(input.storeId, persistence);
      return { ok: true };

    case "complete-activation":
      await completeOnboardingStep(input.storeId, "executive_briefing", persistence);
      return { ok: true, redirectTo: "/app" };

    default:
      return { ok: false, error: "unknown_intent" };
  }
}

export async function runOnboardingAiInitialization(
  storeId: string,
  persistence: OnboardingPersistence = defaultPersistence,
): Promise<void> {
  await updateAiInitializationState(
    storeId,
    {
      status: "running",
      completedAgents: [],
      failedAgents: [],
      currentAgentId: ONBOARDING_AI_AGENTS[0]?.id ?? null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastError: null,
    },
    persistence,
  );

  const product = await prisma.product.findFirst({
    where: { storeId },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  const completedAgents: string[] = [];
  const failedAgents: string[] = [];

  for (const agent of ONBOARDING_AI_AGENTS) {
    await updateAiInitializationState(storeId, { currentAgentId: agent.id }, persistence);

    try {
      switch (agent.id) {
        case "product_intelligence":
          if (product) {
            await executeProductIntelligence({ storeId, productId: product.id, force: true });
          }
          break;
        case "inventory_intelligence":
          await executeInventoryIntelligence({ storeId, force: true });
          break;
        case "bundle_discovery":
          await executeBundleDiscovery({ storeId, force: true });
          break;
        case "store_audit":
          await executeStoreAudit({ storeId, force: true });
          break;
        case "seo_intelligence":
          await executeSeoIntelligence({ storeId, force: true });
          break;
        case "pricing_intelligence":
          await executePricingIntelligence({ storeId, force: true });
          break;
        case "growth_intelligence":
          await executeGrowthIntelligence({ storeId, force: true });
          break;
        case "executive_coo":
          await executeExecutiveCoo({ storeId, force: true });
          break;
      }
      completedAgents.push(agent.id);
    } catch (error) {
      failedAgents.push(agent.id);
      await updateAiInitializationState(
        storeId,
        {
          failedAgents: [...failedAgents],
          lastError: error instanceof Error ? error.message : "agent_initialization_failed",
        },
        persistence,
      );
    }

    await updateAiInitializationState(
      storeId,
      { completedAgents: [...completedAgents], failedAgents: [...failedAgents] },
      persistence,
    );
  }

  const finalStatus = failedAgents.length > 0 && completedAgents.length === 0 ? "failed" : "completed";

  await updateAiInitializationState(
    storeId,
    {
      status: finalStatus,
      currentAgentId: null,
      completedAt: new Date().toISOString(),
    },
    persistence,
  );

  if (finalStatus === "completed") {
    await completeOnboardingStep(storeId, "ai_init", persistence);
  }
}

export { ONBOARDING_AI_AGENTS, defaultPersistence as onboardingActionPersistence };
