import prisma from "../../db.server";
import type { MerchantIntelligenceUiData } from "../shared/types";

export async function getDecisionJournal(storeId: string, limit = 20) {
  return prisma.decisionJournal.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getMerchantProfile(storeId: string) {
  const [behavior, personalization, adaptiveScore, readiness] = await Promise.all([
    prisma.merchantBehaviorProfile.findUnique({ where: { storeId } }),
    prisma.personalizationProfile.findUnique({ where: { storeId } }),
    prisma.adaptiveScore.findUnique({ where: { storeId } }),
    prisma.learningReadiness.findUnique({ where: { storeId } }),
  ]);
  return { behavior, personalization, adaptiveScore, readiness };
}

export async function getMerchantBehavior(storeId: string) {
  return prisma.merchantBehaviorProfile.findUnique({ where: { storeId } });
}

export async function getAdaptiveMemory(storeId: string) {
  return prisma.adaptiveMemory.findMany({
    where: { storeId },
    orderBy: { lastUpdatedAt: "desc" },
    take: 20,
  });
}

export async function getAdaptiveScore(storeId: string) {
  return prisma.adaptiveScore.findUnique({ where: { storeId } });
}

export async function getRecommendationLearning(storeId: string) {
  return prisma.recommendationOutcome.findMany({
    where: { storeId },
    orderBy: { recordedAt: "desc" },
    take: 20,
  });
}

export async function getPredictionLearning(storeId: string) {
  return prisma.predictionAccuracyRecord.findMany({
    where: { storeId },
    orderBy: { evaluatedAt: "desc" },
    take: 20,
  });
}

export async function getExperimentLearning(storeId: string) {
  return prisma.experimentLearning.findMany({
    where: { storeId },
    orderBy: { emittedAt: "desc" },
    take: 20,
  });
}

export async function getRootCauseLearning(storeId: string) {
  return prisma.rootCauseValidation.findMany({
    where: { storeId },
    orderBy: { validatedAt: "desc" },
    take: 20,
  });
}

export async function getBusinessDna(storeId: string) {
  return prisma.businessDnaVersion.findFirst({
    where: { storeId },
    orderBy: { versionNumber: "desc" },
  });
}

export async function getMerchantTimeline(storeId: string, limit = 20) {
  return prisma.merchantTimeline.findMany({
    where: { storeId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

export async function getConfidenceEvolution(storeId: string) {
  return prisma.adaptiveConfidence.findMany({
    where: { storeId },
    orderBy: { computedAt: "desc" },
    take: 20,
  });
}

export async function getMerchantIntelligenceUiData(
  storeId: string,
): Promise<MerchantIntelligenceUiData | null> {
  const [journalCount, profile, timeline, dna] = await Promise.all([
    prisma.decisionJournal.count({ where: { storeId } }),
    getMerchantProfile(storeId),
    getMerchantTimeline(storeId, 5),
    getBusinessDna(storeId),
  ]);

  if (!profile.adaptiveScore && journalCount === 0) {
    return null;
  }

  return {
    adaptiveScore: profile.adaptiveScore?.score ?? 0,
    decisionJournalCount: journalCount,
    behaviorProfile: profile.behavior
      ? {
          acceptsPricingChanges: Number(profile.behavior.acceptsPricingChanges),
          rejectsInventoryChanges: Number(profile.behavior.rejectsInventoryChanges),
          ignoresSeo: Number(profile.behavior.ignoresSeo),
          prefersAutomation: Number(profile.behavior.prefersAutomation),
          acceptsHighConfidenceOnly: Number(profile.behavior.acceptsHighConfidenceOnly),
          approvesWeekendExperiments: Number(profile.behavior.approvesWeekendExperiments),
          actsQuickly: Number(profile.behavior.actsQuickly),
          delaysDecisions: Number(profile.behavior.delaysDecisions),
          prefersLowRisk: Number(profile.behavior.prefersLowRisk),
          prefersLongTermGrowth: Number(profile.behavior.prefersLongTermGrowth),
          prefersOperationalEfficiency: Number(profile.behavior.prefersOperationalEfficiency),
        }
      : null,
    personalization: profile.personalization
      ? {
          priorityDomains: normalizeStringArray(profile.personalization.priorityDomains),
          deprioritizedDomains: normalizeStringArray(profile.personalization.deprioritizedDomains),
          decisionStyle: profile.personalization.decisionStyle,
          riskTolerance: profile.personalization.riskTolerance,
          automationReadiness: Number(profile.personalization.automationReadiness),
        }
      : null,
    recentTimeline: timeline.map((event) => ({
      title: event.title,
      eventCategory: event.eventCategory,
      occurredAt: event.occurredAt.toISOString(),
    })),
    dnaVersion: dna?.versionNumber ?? 0,
    learningStage: profile.readiness?.stage ?? "initializing",
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export { runMerchantIntelligence, refreshMerchantProfile } from "../engine/merchant-intelligence-engine";
