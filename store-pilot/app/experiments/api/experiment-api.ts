import type { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import { scheduleMerchantIntelligenceRefreshJob } from "../../merchant-intelligence/scheduler/merchant-intelligence-scheduler";
import {
  buildExperimentCancelledEvent,
  buildExperimentRejectedEvent,
} from "../learning/learning-hooks";
import type { ExperimentUiItem } from "../shared/types";

export async function getExperimentRecommendations(storeId: string) {
  return prisma.experimentRecommendation.findMany({
    where: { storeId, active: true },
    orderBy: [{ expectedMonthlyGain: "desc" }],
    include: { experiment: true },
    take: 10,
  });
}

export async function getSuggestedExperiments(storeId: string) {
  return prisma.experiment.findMany({
    where: {
      storeId,
      active: true,
      status: { in: ["shadow_simulated", "pending_approval", "suggested"] },
    },
    orderBy: [{ rankScore: "desc" }],
    include: {
      recommendations: { where: { active: true }, take: 1 },
    },
    take: 10,
  });
}

export async function getExperiment(storeId: string, experimentId: string) {
  return prisma.experiment.findFirst({
    where: { storeId, id: experimentId },
    include: {
      variants: true,
      baselines: true,
      results: true,
      winners: true,
      confidences: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
}

export async function getExperimentBaseline(storeId: string, experimentId: string) {
  return prisma.experimentBaseline.findFirst({
    where: { storeId, experimentId },
    orderBy: { capturedAt: "desc" },
  });
}

export async function getExperimentResults(storeId: string, experimentId: string) {
  return prisma.experimentResult.findMany({
    where: { storeId, experimentId },
    orderBy: { computedAt: "desc" },
  });
}

export async function getExperimentWinner(storeId: string, experimentId: string) {
  return prisma.experimentWinner.findFirst({
    where: { storeId, experimentId },
    orderBy: { selectedAt: "desc" },
  });
}

export async function getExperimentConfidence(storeId: string, experimentId: string) {
  return prisma.experimentConfidence.findFirst({
    where: { storeId, experimentId },
    orderBy: { computedAt: "desc" },
  });
}

export async function getExperimentUiItems(storeId: string): Promise<ExperimentUiItem[]> {
  const experiments = await getSuggestedExperiments(storeId);
  return experiments.slice(0, 6).map((experiment) => ({
    experimentId: experiment.id,
    title: experiment.title,
    proposedChange: experiment.proposedChange,
    reason: experiment.recommendations[0]?.reason ?? experiment.businessProblem,
    expectedMonthlyGain: Number(experiment.expectedRevenueImpact),
    confidencePercent: Math.round(Number(experiment.confidence) * 100),
    businessRisk: experiment.businessRisk,
    estimatedDurationDays: experiment.estimatedDurationDays,
    status: experiment.status,
  }));
}

export async function approveExperiment(storeId: string, experimentId: string) {
  const experiment = await prisma.experiment.findFirst({
    where: { storeId, id: experimentId, active: true },
  });
  if (!experiment) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experiment.update({
      where: { id: experimentId },
      data: { status: "approved" },
    });

    await tx.experimentHistory.create({
      data: {
        storeId,
        experimentId,
        changeType: "approved",
        snapshot: updated as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.experimentLearning.create({
      data: {
        storeId,
        experimentId,
        eventType: "ExperimentStarted",
        eventJson: { approvedBy: "merchant", approvedAt: new Date().toISOString() },
        memoryIds: experiment.memoryIds as Prisma.InputJsonValue,
        evidenceIds: experiment.evidenceIds as Prisma.InputJsonValue,
      },
    });

    return updated;
  }).then((updated) => {
    void scheduleMerchantIntelligenceRefreshJob({
      storeId,
      idempotencyKey: `merchant-intel:experiment-approved:${experimentId}`,
    }).catch(() => undefined);
    return updated;
  });
}

export async function dismissExperiment(storeId: string, experimentId: string) {
  const experiment = await prisma.experiment.findFirst({
    where: { storeId, id: experimentId },
  });
  if (!experiment) {
    return null;
  }

  const event = buildExperimentRejectedEvent({
    experimentKey: experiment.experimentKey,
    experimentDomain: experiment.experimentDomain,
    templateKey: experiment.templateKey,
    title: experiment.title,
    businessProblem: experiment.businessProblem,
    proposedChange: experiment.proposedChange,
    expectedRevenueImpact: Number(experiment.expectedRevenueImpact),
    expectedProfitImpact: Number(experiment.expectedProfitImpact),
    confidence: Number(experiment.confidence),
    estimatedDurationDays: experiment.estimatedDurationDays,
    merchantEffort: experiment.merchantEffort,
    businessRisk: experiment.businessRisk,
    baselineMetrics: experiment.baselineMetrics as never,
    successMetrics: experiment.successMetrics as never,
    evidenceIds: [],
    graphNodeIds: [],
    memoryIds: [],
    predictionIds: [],
    rootCauseIds: [],
    recommendationSource: experiment.recommendationSource,
    shadowSimulationJson: {},
    status: "dismissed",
    rankScore: Number(experiment.rankScore),
    variants: [],
    reason: "",
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experiment.update({
      where: { id: experimentId },
      data: { status: "dismissed", active: false },
    });

    await tx.experimentRecommendation.updateMany({
      where: { storeId, experimentId },
      data: { active: false },
    });

    await tx.experimentHistory.create({
      data: {
        storeId,
        experimentId,
        changeType: "dismissed",
        snapshot: updated as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.experimentLearning.create({
      data: {
        storeId,
        experimentId,
        eventType: event.eventType,
        eventJson: event.eventJson as Prisma.InputJsonValue,
        memoryIds: event.memoryIds as Prisma.InputJsonValue,
        evidenceIds: event.evidenceIds as Prisma.InputJsonValue,
      },
    });

    return updated;
  }).then((updated) => {
    void scheduleMerchantIntelligenceRefreshJob({
      storeId,
      idempotencyKey: `merchant-intel:experiment-dismissed:${experimentId}`,
    }).catch(() => undefined);
    return updated;
  });
}

export async function cancelExperiment(storeId: string, experimentId: string) {
  const experiment = await prisma.experiment.findFirst({
    where: { storeId, id: experimentId },
  });
  if (!experiment) {
    return null;
  }

  const event = buildExperimentCancelledEvent({
    experimentKey: experiment.experimentKey,
    experimentDomain: experiment.experimentDomain,
    templateKey: experiment.templateKey,
    title: experiment.title,
    businessProblem: experiment.businessProblem,
    proposedChange: experiment.proposedChange,
    expectedRevenueImpact: Number(experiment.expectedRevenueImpact),
    expectedProfitImpact: Number(experiment.expectedProfitImpact),
    confidence: Number(experiment.confidence),
    estimatedDurationDays: experiment.estimatedDurationDays,
    merchantEffort: experiment.merchantEffort,
    businessRisk: experiment.businessRisk,
    baselineMetrics: experiment.baselineMetrics as never,
    successMetrics: experiment.successMetrics as never,
    evidenceIds: [],
    graphNodeIds: [],
    memoryIds: [],
    predictionIds: [],
    rootCauseIds: [],
    recommendationSource: experiment.recommendationSource,
    shadowSimulationJson: {},
    status: "cancelled",
    rankScore: Number(experiment.rankScore),
    variants: [],
    reason: "",
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.experiment.update({
      where: { id: experimentId },
      data: { status: "cancelled", active: false },
    });

    await tx.experimentHistory.create({
      data: {
        storeId,
        experimentId,
        changeType: "cancelled",
        snapshot: updated as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.experimentLearning.create({
      data: {
        storeId,
        experimentId,
        eventType: event.eventType,
        eventJson: event.eventJson as Prisma.InputJsonValue,
        memoryIds: event.memoryIds as Prisma.InputJsonValue,
        evidenceIds: event.evidenceIds as Prisma.InputJsonValue,
      },
    });

    return updated;
  }).then((updated) => {
    void scheduleMerchantIntelligenceRefreshJob({
      storeId,
      idempotencyKey: `merchant-intel:experiment-cancelled:${experimentId}`,
    }).catch(() => undefined);
    return updated;
  });
}

export { runExperimentEngine } from "../engine/experiment-engine";
