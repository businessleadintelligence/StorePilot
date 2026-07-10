import type { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import type { BootstrapIntelligenceResult } from "../shared/types";

export async function persistBootstrapIntelligence(
  result: BootstrapIntelligenceResult,
): Promise<void> {
  const { storeId, snapshot, scores, duration } = result;

  await prisma.$transaction([
    prisma.storeLearningProfile.upsert({
      where: { storeId },
      create: {
        storeId,
        storeSize: result.storeSize,
        productsCount: snapshot.productsCount,
        variantsCount: snapshot.variantsCount,
        collectionsCount: snapshot.collectionsCount,
        ordersCount: snapshot.ordersCount,
        inventoryItemsCount: snapshot.inventoryItemsCount,
        locationsCount: snapshot.locationsCount,
        vendorsCount: snapshot.vendorsCount,
        uniqueTagsCount: snapshot.uniqueTagsCount,
        averageVariantsPerProduct: snapshot.averageVariantsPerProduct,
        catalogComplexityScore: scores.catalogComplexityScore,
        historicalDepthScore: scores.historicalDepthScore,
        operationalComplexityScore: scores.operationalComplexityScore,
        estimatedHistoryMonths: snapshot.estimatedHistoryMonths,
        storeAgeDays: snapshot.storeAgeDays,
        oldestOrderAt: snapshot.oldestOrderAt,
        newestOrderAt: snapshot.newestOrderAt,
        expectedLearningDurationMinutes: duration.totalEstimatedMinutes,
        workerEstimateMinutes: duration.workerEstimateMinutes,
        futureAiCostEstimateUsd: duration.futureAiCostEstimateUsd,
        bootstrapStatus: "complete",
        profileJson: snapshot as unknown as Prisma.InputJsonValue,
        profiledAt: new Date(),
      },
      update: {
        storeSize: result.storeSize,
        productsCount: snapshot.productsCount,
        variantsCount: snapshot.variantsCount,
        collectionsCount: snapshot.collectionsCount,
        ordersCount: snapshot.ordersCount,
        inventoryItemsCount: snapshot.inventoryItemsCount,
        locationsCount: snapshot.locationsCount,
        vendorsCount: snapshot.vendorsCount,
        uniqueTagsCount: snapshot.uniqueTagsCount,
        averageVariantsPerProduct: snapshot.averageVariantsPerProduct,
        catalogComplexityScore: scores.catalogComplexityScore,
        historicalDepthScore: scores.historicalDepthScore,
        operationalComplexityScore: scores.operationalComplexityScore,
        estimatedHistoryMonths: snapshot.estimatedHistoryMonths,
        storeAgeDays: snapshot.storeAgeDays,
        oldestOrderAt: snapshot.oldestOrderAt,
        newestOrderAt: snapshot.newestOrderAt,
        expectedLearningDurationMinutes: duration.totalEstimatedMinutes,
        workerEstimateMinutes: duration.workerEstimateMinutes,
        futureAiCostEstimateUsd: duration.futureAiCostEstimateUsd,
        bootstrapStatus: "complete",
        profileJson: snapshot as unknown as Prisma.InputJsonValue,
        profiledAt: new Date(),
      },
    }),
    prisma.learningReadiness.upsert({
      where: { storeId },
      create: {
        storeId,
        stage: result.stage,
        overallConfidencePercent: result.overallConfidencePercent,
        inventoryConfidence: result.confidences.inventory,
        productsConfidence: result.confidences.products,
        pricingConfidence: result.confidences.pricing,
        seoConfidence: result.confidences.seo,
        collectionsConfidence: result.confidences.collections,
        operationsConfidence: result.confidences.operations,
        seasonalityConfidence: result.confidences.seasonality,
        executiveCooReady: false,
        predictionReady: false,
        experimentReady: false,
        merchantIntelligenceReady: false,
        merchantMessage: result.merchantMessage,
        stageExplanation: result.stageExplanation,
        stageStartedAt: new Date(),
        lastComputedAt: new Date(),
      },
      update: {
        stage: result.stage,
        overallConfidencePercent: result.overallConfidencePercent,
        inventoryConfidence: result.confidences.inventory,
        productsConfidence: result.confidences.products,
        pricingConfidence: result.confidences.pricing,
        seoConfidence: result.confidences.seo,
        collectionsConfidence: result.confidences.collections,
        operationsConfidence: result.confidences.operations,
        seasonalityConfidence: result.confidences.seasonality,
        merchantMessage: result.merchantMessage,
        stageExplanation: result.stageExplanation,
        lastComputedAt: new Date(),
      },
    }),
    prisma.learningEta.upsert({
      where: { storeId },
      create: {
        storeId,
        bootstrapDurationMinutes: duration.bootstrapDurationMinutes,
        historicalImportMinutes: duration.historicalImportMinutes,
        graphBuildMinutes: duration.graphBuildMinutes,
        quickWinMinutes: duration.quickWinMinutes,
        totalEstimatedMinutes: duration.totalEstimatedMinutes,
        estimatedCompletionAt: new Date(Date.now() + duration.totalEstimatedMinutes * 60_000),
        historyMonthsDisplay: result.historyMonthsDisplay,
        merchantHeadline: result.merchantHeadline,
        lastComputedAt: new Date(),
      },
      update: {
        bootstrapDurationMinutes: duration.bootstrapDurationMinutes,
        historicalImportMinutes: duration.historicalImportMinutes,
        graphBuildMinutes: duration.graphBuildMinutes,
        quickWinMinutes: duration.quickWinMinutes,
        totalEstimatedMinutes: duration.totalEstimatedMinutes,
        estimatedCompletionAt: new Date(Date.now() + duration.totalEstimatedMinutes * 60_000),
        historyMonthsDisplay: result.historyMonthsDisplay,
        merchantHeadline: result.merchantHeadline,
        lastComputedAt: new Date(),
      },
    }),
    prisma.learningPriority.deleteMany({ where: { storeId } }),
  ]);

  if (result.priorities.length > 0) {
    await prisma.learningPriority.createMany({
      data: result.priorities.map((priority) => ({
        storeId,
        domain: priority.domain,
        priorityOrder: priority.priorityOrder,
      })),
    });
  }

  await prisma.learningVelocity.deleteMany({ where: { storeId } });
  if (result.velocities.length > 0) {
    await prisma.learningVelocity.createMany({
      data: result.velocities.map((velocity) => ({
        storeId,
        domain: velocity.domain,
        velocity: velocity.velocity,
        statusLabel: velocity.statusLabel,
      })),
    });
  }

  await prisma.knowledgeSyncCheckpoint.upsert({
    where: { storeId },
    create: {
      storeId,
      status: "idle",
      checkpointJson: { learningBootstrapComplete: true, priorityOrder: result.priorities },
    },
    update: {
      checkpointJson: { learningBootstrapComplete: true, priorityOrder: result.priorities },
    },
  });
}

export async function markBootstrapRunning(storeId: string): Promise<void> {
  await prisma.storeLearningProfile.upsert({
    where: { storeId },
    create: { storeId, bootstrapStatus: "running" },
    update: { bootstrapStatus: "running" },
  });
}

export async function markBootstrapFailed(storeId: string): Promise<void> {
  await prisma.storeLearningProfile.upsert({
    where: { storeId },
    create: { storeId, bootstrapStatus: "failed" },
    update: { bootstrapStatus: "failed" },
  });
}
