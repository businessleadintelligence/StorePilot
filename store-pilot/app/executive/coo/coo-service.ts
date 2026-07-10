import type { Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "../../db.server";
import { createAIFoundationClient } from "../../ai/foundation/client";
import {
  buildDeterministicBriefing,
  buildDeterministicOperatingPlan,
  buildExecutiveCooPrompt,
} from "../prompt-builder/executive-prompt-builder";
import { getRootCauses } from "../../root-cause/api/root-cause-api";
import { getPredictions, getBusinessStability, getPreventionActions } from "../../prediction/api/prediction-api";
import { getMerchantProfile } from "../../merchant-intelligence/api/merchant-intelligence-api";
import { getExperimentRecommendations, getSuggestedExperiments } from "../../experiments/api/experiment-api";
import type {
  BusinessContextPayload,
  DailyOperatingPlanPayload,
  ExecutiveBriefingPayload,
} from "../shared/types";

const ExecutiveBriefingSchema = z.object({
  headline: z.string(),
  greeting: z.string(),
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      content: z.string(),
      priority: z.number(),
    }),
  ),
  topPriority: z.string(),
  todaysFocus: z.array(z.string()),
  businessOutlook: z.string(),
});

const DailyOperatingPlanSchema = z.object({
  title: z.string(),
  estimatedCompletionMinutes: z.number(),
  estimatedRevenueOpportunity: z.number(),
  estimatedProfitOpportunity: z.number(),
  taskCount: z.number(),
  tasks: z.array(
    z.object({
      decisionId: z.string(),
      title: z.string(),
      description: z.string(),
      reason: z.string(),
      evidenceIds: z.array(z.string()),
      businessImpact: z.number(),
      estimatedEffort: z.number(),
      estimatedTimeMinutes: z.number(),
      confidence: z.number(),
      actions: z.array(z.enum(["approve", "ignore", "learn_more"])),
    }),
  ),
});

export async function runExecutiveCoo(input: {
  storeId: string;
  contextSnapshotId?: string;
}): Promise<{
  briefing: ExecutiveBriefingPayload;
  operatingPlan: DailyOperatingPlanPayload;
  generatedBy: string;
}> {
  const context = await loadBusinessContextSnapshot(input.storeId, input.contextSnapshotId);
  const rootCauses = await getRootCauses(input.storeId);
  context.rootCauseAnalysis = rootCauses.slice(0, 5).map((cause) => ({
    primaryCause: cause.primaryCause,
    businessOutcome: cause.businessOutcome,
    confidence: Number(cause.confidence),
    evidenceIds: normalizeStringArray(cause.evidenceIds),
    causalChain: cause.causalChain,
    timeline: cause.timeline,
  }));

  const [predictions, businessStability, preventionActions] = await Promise.all([
    getPredictions(input.storeId),
    getBusinessStability(input.storeId),
    getPreventionActions(input.storeId),
  ]);
  context.predictionAnalysis = predictions.slice(0, 5).map((prediction) => ({
    predictionType: prediction.predictionType,
    title: prediction.title,
    predictedOutcome: prediction.predictedOutcome,
    confidence: Number(prediction.confidence),
    forecastWindow: prediction.forecastWindow,
    expectedBusinessImpact: Number(prediction.expectedBusinessImpact),
    evidenceIds: normalizeStringArray(prediction.evidenceIds),
  }));
  context.preventionRecommendations = preventionActions.slice(0, 5).map((action) => ({
    actionType: action.actionType,
    title: action.title,
    recommendedAction: action.recommendedAction,
    expectedImpactProtected: Number(action.expectedImpactProtected),
    confidence: Number(action.confidence),
  }));
  context.businessStability = businessStability
    ? {
        score: businessStability.score,
        forecastVolatilityScore: businessStability.forecastVolatilityScore,
        inventoryRiskScore: businessStability.inventoryRiskScore,
        revenueStabilityScore: businessStability.revenueStabilityScore,
      }
    : { score: 0 };

  const [experimentRecommendations, suggestedExperiments] = await Promise.all([
    getExperimentRecommendations(input.storeId),
    getSuggestedExperiments(input.storeId),
  ]);
  context.experimentSummary = {
    topRecommendedExperiment: experimentRecommendations[0]?.title ?? suggestedExperiments[0]?.title ?? null,
    expectedRevenueGain: Number(
      experimentRecommendations[0]?.expectedMonthlyGain ??
        suggestedExperiments[0]?.expectedRevenueImpact ??
        0,
    ),
    expectedRisk: experimentRecommendations[0]?.businessRisk ?? suggestedExperiments[0]?.businessRisk ?? "medium",
    confidence: Number(
      experimentRecommendations[0]?.confidence ?? suggestedExperiments[0]?.confidence ?? 0,
    ),
    recommendationCount: experimentRecommendations.length,
    shadowMode: true,
  };
  context.experimentRecommendations = experimentRecommendations.slice(0, 5).map((rec) => ({
    title: rec.title,
    reason: rec.reason,
    expectedMonthlyGain: Number(rec.expectedMonthlyGain),
    confidence: Number(rec.confidence),
    businessRisk: rec.businessRisk,
    estimatedDurationDays: rec.estimatedDurationDays,
  }));

  const merchantProfile = await getMerchantProfile(input.storeId);
  context.merchantIntelligence = {
    adaptiveScore: merchantProfile.adaptiveScore?.score ?? 0,
    decisionStyle: merchantProfile.personalization?.decisionStyle ?? "balanced",
    riskTolerance: merchantProfile.personalization?.riskTolerance ?? "medium",
    priorityDomains: normalizeStringArray(merchantProfile.personalization?.priorityDomains),
    deprioritizedDomains: normalizeStringArray(merchantProfile.personalization?.deprioritizedDomains),
    acceptsPricingChanges: merchantProfile.behavior
      ? Number(merchantProfile.behavior.acceptsPricingChanges)
      : 0.5,
    learningStage: merchantProfile.readiness?.stage ?? "operational",
  };

  const decisions = context.priorityDecisions;
  const deterministicBriefing = buildDeterministicBriefing(context);
  const deterministicPlan = buildDeterministicOperatingPlan(decisions);

  const aiEnabled = process.env.AI_PLATFORM_ENABLED === "true";
  if (!aiEnabled) {
    await persistExecutiveOutputs({
      storeId: input.storeId,
      contextSnapshotId: input.contextSnapshotId,
      briefing: deterministicBriefing,
      operatingPlan: deterministicPlan,
      generatedBy: "deterministic",
    });
    return {
      briefing: deterministicBriefing,
      operatingPlan: deterministicPlan,
      generatedBy: "deterministic",
    };
  }

  const client = createAIFoundationClient();
  const promptPayload = buildExecutiveCooPrompt(context);

  const [briefingResult, planResult] = await Promise.all([
    client.execute({
      promptId: "ExecutiveBriefing",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced Shopify COO. Use only the structured business context provided. Never invent facts. Reference decisions and evidence from context.",
        },
        {
          role: "user",
          content: `Generate an executive briefing from this structured context:\n${promptPayload}`,
        },
      ],
      context: {
        storeId: input.storeId,
        feature: "executive_coo",
        taskCategory: "executive_reasoning",
        agentId: "executive_coo",
      },
      output: {
        schema: ExecutiveBriefingSchema,
        schemaName: "ExecutiveBriefingOutput",
      },
    }),
    client.execute({
      promptId: "DailyOperatingPlan",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced Shopify COO. Build a daily operating plan from structured context only. Never invent facts.",
        },
        {
          role: "user",
          content: `Generate a daily operating plan from this structured context:\n${promptPayload}`,
        },
      ],
      context: {
        storeId: input.storeId,
        feature: "executive_coo",
        taskCategory: "executive_summary",
        agentId: "executive_coo",
      },
      output: {
        schema: DailyOperatingPlanSchema,
        schemaName: "DailyOperatingPlanOutput",
      },
    }),
  ]);

  const briefing =
    briefingResult.ok ? briefingResult.data : deterministicBriefing;
  const operatingPlan = planResult.ok ? planResult.data : deterministicPlan;
  const generatedBy =
    briefingResult.ok && planResult.ok ? "ai_foundation" : "deterministic_fallback";

  await persistExecutiveOutputs({
    storeId: input.storeId,
    contextSnapshotId: input.contextSnapshotId,
    briefing,
    operatingPlan,
    generatedBy,
  });

  return { briefing, operatingPlan, generatedBy };
}

async function loadBusinessContextSnapshot(
  storeId: string,
  contextSnapshotId?: string,
): Promise<BusinessContextPayload> {
  const snapshot = contextSnapshotId
    ? await prisma.businessContextSnapshot.findUnique({
        where: { id: contextSnapshotId },
      })
    : await prisma.businessContextSnapshot.findFirst({
        where: { storeId },
        orderBy: { createdAt: "desc" },
      });

  if (!snapshot) {
    throw new Error(`Business context snapshot not found for store ${storeId}`);
  }

  return snapshot.contextJson as unknown as BusinessContextPayload;
}

async function persistExecutiveOutputs(input: {
  storeId: string;
  contextSnapshotId?: string;
  briefing: ExecutiveBriefingPayload;
  operatingPlan: DailyOperatingPlanPayload;
  generatedBy: string;
}): Promise<void> {
  const dateKey = new Date().toISOString().slice(0, 10);

  await prisma.$transaction([
    prisma.executiveBriefing.upsert({
      where: {
        storeId_briefingDate: {
          storeId: input.storeId,
          briefingDate: dateKey,
        },
      },
      create: {
        storeId: input.storeId,
        briefingDate: dateKey,
        headline: input.briefing.headline,
        briefingJson: input.briefing as unknown as Prisma.InputJsonValue,
        contextSnapshotId: input.contextSnapshotId,
        generatedBy: input.generatedBy,
      },
      update: {
        headline: input.briefing.headline,
        briefingJson: input.briefing as unknown as Prisma.InputJsonValue,
        contextSnapshotId: input.contextSnapshotId,
        generatedBy: input.generatedBy,
      },
    }),
    prisma.dailyOperatingPlan.upsert({
      where: {
        storeId_planDate: {
          storeId: input.storeId,
          planDate: dateKey,
        },
      },
      create: {
        storeId: input.storeId,
        planDate: dateKey,
        estimatedCompletionMinutes: input.operatingPlan.estimatedCompletionMinutes,
        estimatedRevenueOpportunity: input.operatingPlan.estimatedRevenueOpportunity,
        estimatedProfitOpportunity: input.operatingPlan.estimatedProfitOpportunity,
        taskCount: input.operatingPlan.taskCount,
        planJson: input.operatingPlan as unknown as Prisma.InputJsonValue,
        contextSnapshotId: input.contextSnapshotId,
        generatedBy: input.generatedBy,
      },
      update: {
        estimatedCompletionMinutes: input.operatingPlan.estimatedCompletionMinutes,
        estimatedRevenueOpportunity: input.operatingPlan.estimatedRevenueOpportunity,
        estimatedProfitOpportunity: input.operatingPlan.estimatedProfitOpportunity,
        taskCount: input.operatingPlan.taskCount,
        planJson: input.operatingPlan as unknown as Prisma.InputJsonValue,
        contextSnapshotId: input.contextSnapshotId,
        generatedBy: input.generatedBy,
      },
    }),
  ]);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
