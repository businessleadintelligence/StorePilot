import prisma from "../../db.server";
import type { MerchantIntelligenceContext } from "../shared/types";

export async function loadMerchantIntelligenceContext(
  storeId: string,
): Promise<MerchantIntelligenceContext> {
  const [
    patternSeeds,
    businessDna,
    experimentEvents,
    executiveDecisions,
    predictions,
    rootCauses,
    experiments,
    businessStability,
    checkpoint,
  ] = await Promise.all([
    prisma.patternSeed.findMany({ where: { storeId } }),
    prisma.businessDnaVersion.findFirst({
      where: { storeId },
      orderBy: { versionNumber: "desc" },
    }),
    prisma.experimentLearning.findMany({
      where: { storeId },
      orderBy: { emittedAt: "desc" },
      take: 50,
    }),
    prisma.executiveDecision.findMany({
      where: { storeId, active: true },
      orderBy: { rankScore: "desc" },
      take: 20,
    }),
    prisma.prediction.findMany({
      where: { storeId, active: true },
      take: 20,
    }),
    prisma.rootCause.findMany({
      where: { storeId, active: true },
      take: 20,
    }),
    prisma.experiment.findMany({
      where: { storeId, active: true },
      take: 20,
    }),
    prisma.businessStability.findUnique({ where: { storeId } }),
    prisma.learningSnapshot.findUnique({
      where: { storeId_snapshotKey: { storeId, snapshotKey: "merchant_intel" } },
    }),
  ]);

  return {
    storeId,
    patternSeeds: patternSeeds.map((seed) => ({
      id: seed.id,
      patternType: seed.patternType,
      semanticLabel: seed.semanticLabel,
      confidence: Number(seed.confidence),
      patternJson: (seed.patternJson ?? {}) as Record<string, unknown>,
    })),
    businessDna: businessDna ? (businessDna.dnaJson as Record<string, unknown>) : null,
    businessDnaVersion: businessDna?.versionNumber ?? 0,
    journalEntries: [],
    experimentEvents: experimentEvents.map((event) => ({
      id: event.id,
      experimentId: event.experimentId,
      eventType: event.eventType,
      eventJson: (event.eventJson ?? {}) as Record<string, unknown>,
      evidenceIds: normalizeArray(event.evidenceIds),
      memoryIds: normalizeArray(event.memoryIds),
    })),
    executiveDecisions: executiveDecisions.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      confidence: Number(d.confidence),
      evidenceIds: normalizeArray(d.evidenceIds),
    })),
    predictions: predictions.map((p) => ({
      id: p.id,
      predictionKey: p.predictionKey,
      confidence: Number(p.confidence),
      expectedBusinessImpact: Number(p.expectedBusinessImpact),
    })),
    rootCauses: rootCauses.map((c) => ({
      id: c.id,
      primaryCause: c.primaryCause,
      confidence: Number(c.confidence),
      businessOutcome: c.businessOutcome,
    })),
    experiments: experiments.map((e) => ({
      id: e.id,
      experimentKey: e.experimentKey,
      status: e.status,
      confidence: Number(e.confidence),
      expectedRevenueImpact: Number(e.expectedRevenueImpact),
    })),
    businessStabilityScore: businessStability?.score ?? 50,
    lastCheckpointAt: checkpoint?.createdAt?.toISOString() ?? null,
  };
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
