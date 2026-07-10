import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import prisma from "../../../db.server";
import { assertJsonPayloadFreeOfCustomerPii } from "../../../lib/json-pii-guard.server";
import type {
  BusinessMemoryBundle,
  HistoricalIntelligenceResult,
} from "../shared/types";

export function hashHistoricalSnapshot(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function persistHistoricalIntelligence(
  bundle: BusinessMemoryBundle,
  input: {
    graphVersion?: number;
    overallConfidencePercent: number;
  },
): Promise<HistoricalIntelligenceResult> {
  assertJsonPayloadFreeOfCustomerPii(bundle, "HistoricalIntelligence.bundle");
  const storeId = bundle.storeId;

  const existingMemory = await prisma.historicalMemory.findUnique({
    where: { storeId },
  });
  const memoryVersion = (existingMemory?.version ?? 0) + 1;

  const existingSnapshot = await prisma.historicalSnapshot.findFirst({
    where: { storeId },
    orderBy: { versionNumber: "desc" },
  });
  const snapshotVersion = (existingSnapshot?.versionNumber ?? 0) + 1;

  const existingDna = await prisma.businessDnaVersion.findFirst({
    where: { storeId },
    orderBy: { versionNumber: "desc" },
  });
  const dnaVersion = (existingDna?.versionNumber ?? 0) + 1;

  await prisma.$transaction([
    prisma.merchantBaseline.deleteMany({ where: { storeId } }),
    prisma.patternSeed.deleteMany({ where: { storeId } }),
    prisma.confidenceSeed.deleteMany({ where: { storeId } }),
  ]);

  if (bundle.baselines.length > 0) {
    await prisma.merchantBaseline.createMany({
      data: bundle.baselines.map((baseline) => ({
        storeId,
        baselineType: baseline.baselineType,
        baselineJson: baseline.baselineJson as Prisma.InputJsonValue,
        confidence: baseline.confidence,
      })),
    });
  }

  for (const pattern of bundle.patterns) {
    await prisma.patternSeed.upsert({
      where: {
        storeId_patternType_semanticLabel: {
          storeId,
          patternType: pattern.patternType,
          semanticLabel: pattern.semanticLabel,
        },
      },
      create: {
        storeId,
        patternType: pattern.patternType,
        semanticLabel: pattern.semanticLabel,
        patternJson: pattern.patternJson as Prisma.InputJsonValue,
        confidence: pattern.confidence,
        observationCount: pattern.observationCount,
        evidenceIds: pattern.evidenceIds as Prisma.InputJsonValue,
      },
      update: {
        patternJson: pattern.patternJson as Prisma.InputJsonValue,
        confidence: pattern.confidence,
        observationCount: { increment: pattern.observationCount },
        evidenceIds: pattern.evidenceIds as Prisma.InputJsonValue,
        active: true,
      },
    });
  }

  for (const seed of bundle.confidences) {
    await prisma.confidenceSeed.upsert({
      where: {
        storeId_domain: { storeId, domain: seed.domain },
      },
      create: {
        storeId,
        domain: seed.domain,
        confidencePercent: seed.confidencePercent,
        baselinePercent: seed.baselinePercent,
        evidenceCoverage: seed.evidenceCoverage,
        graphCoverage: seed.graphCoverage,
      },
      update: {
        confidencePercent: seed.confidencePercent,
        baselinePercent: seed.baselinePercent,
        evidenceCoverage: seed.evidenceCoverage,
        graphCoverage: seed.graphCoverage,
      },
    });
  }

  const memoryJson = {
    summary: bundle.summary,
    businessDna: bundle.businessDna,
    baselineTypes: bundle.baselines.map((baseline) => baseline.baselineType),
    patternTypes: bundle.patterns.map((pattern) => pattern.patternType),
  };

  await prisma.historicalMemory.upsert({
    where: { storeId },
    create: {
      storeId,
      version: memoryVersion,
      memoryJson: memoryJson as Prisma.InputJsonValue,
      evidenceCount: bundle.summary.evidenceCount,
      graphVersion: input.graphVersion ?? null,
      patternSeedCount: bundle.patterns.length,
      baselineCount: bundle.baselines.length,
      confidenceScore: input.overallConfidencePercent / 100,
      lastBuiltAt: new Date(),
    },
    update: {
      version: memoryVersion,
      memoryJson: memoryJson as Prisma.InputJsonValue,
      evidenceCount: bundle.summary.evidenceCount,
      graphVersion: input.graphVersion ?? null,
      patternSeedCount: bundle.patterns.length,
      baselineCount: bundle.baselines.length,
      confidenceScore: input.overallConfidencePercent / 100,
      lastBuiltAt: new Date(),
    },
  });

  const baselineSnapshot = Object.fromEntries(
    bundle.baselines.map((baseline) => [baseline.baselineType, baseline.baselineJson]),
  );
  const patternSnapshot = bundle.patterns.map((pattern) => ({
    patternType: pattern.patternType,
    semanticLabel: pattern.semanticLabel,
    confidence: pattern.confidence,
    patternJson: pattern.patternJson,
  }));

  await prisma.historicalSnapshot.create({
    data: {
      storeId,
      versionNumber: snapshotVersion,
      snapshotHash: hashHistoricalSnapshot({ memoryJson, baselineSnapshot, patternSnapshot }),
      memorySnapshot: memoryJson as Prisma.InputJsonValue,
      baselineSnapshot: baselineSnapshot as Prisma.InputJsonValue,
      patternSnapshot: patternSnapshot as Prisma.InputJsonValue,
      graphVersion: input.graphVersion ?? null,
      immutable: true,
    },
  });

  await prisma.businessDnaVersion.create({
    data: {
      storeId,
      versionNumber: dnaVersion,
      dnaJson: bundle.businessDna as Prisma.InputJsonValue,
      graphVersion: input.graphVersion ?? null,
      confidenceScore: input.overallConfidencePercent / 100,
    },
  });

  await updateLearningReadinessFromHistorical(storeId, bundle.confidences, input.overallConfidencePercent);

  await prisma.store.update({
    where: { id: storeId },
    data: { historicalImportDone: true },
  }).catch(() => undefined);

  return {
    success: true,
    storeId,
    memoryVersion,
    snapshotVersion,
    dnaVersion,
    baselineCount: bundle.baselines.length,
    patternSeedCount: bundle.patterns.length,
    confidenceSeedCount: bundle.confidences.length,
    overallConfidencePercent: input.overallConfidencePercent,
    learningStage: "learning",
  };
}

async function updateLearningReadinessFromHistorical(
  storeId: string,
  confidences: BusinessMemoryBundle["confidences"],
  overallConfidencePercent: number,
): Promise<void> {
  const byDomain = Object.fromEntries(confidences.map((seed) => [seed.domain, seed]));

  await prisma.learningReadiness.upsert({
    where: { storeId },
    create: {
      storeId,
      stage: "learning",
      overallConfidencePercent,
      inventoryConfidence: byDomain.inventory?.confidencePercent ?? 0,
      productsConfidence: byDomain.products?.confidencePercent ?? 0,
      pricingConfidence: byDomain.pricing?.confidencePercent ?? 0,
      seoConfidence: byDomain.seo?.confidencePercent ?? 0,
      collectionsConfidence: byDomain.collections?.confidencePercent ?? 0,
      operationsConfidence: byDomain.operations?.confidencePercent ?? 0,
      seasonalityConfidence: byDomain.seasonality?.confidencePercent ?? 0,
      merchantMessage: `Historical learning complete. StorePilot confidence is now ${overallConfidencePercent}%.`,
      stageExplanation:
        "Evidence and graph relationships have been synthesized into business memory.",
      lastComputedAt: new Date(),
    },
    update: {
      stage: "learning",
      overallConfidencePercent,
      inventoryConfidence: byDomain.inventory?.confidencePercent ?? 0,
      productsConfidence: byDomain.products?.confidencePercent ?? 0,
      pricingConfidence: byDomain.pricing?.confidencePercent ?? 0,
      seoConfidence: byDomain.seo?.confidencePercent ?? 0,
      collectionsConfidence: byDomain.collections?.confidencePercent ?? 0,
      operationsConfidence: byDomain.operations?.confidencePercent ?? 0,
      seasonalityConfidence: byDomain.seasonality?.confidencePercent ?? 0,
      merchantMessage: `Historical learning complete. StorePilot confidence is now ${overallConfidencePercent}%.`,
      stageExplanation:
        "Evidence and graph relationships have been synthesized into business memory.",
      lastComputedAt: new Date(),
    },
  });
}
