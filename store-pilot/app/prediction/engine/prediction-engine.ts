import type { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import { computeBusinessStability } from "../confidence/business-stability-scorer";
import { computePredictionConfidence, generatePredictions } from "../forecasting/forecast-generator";
import { planPreventionActions } from "../prevention/action-planner";
import { assessPredictionRisks } from "../risk/risk-assessor";
import type { PredictionEngineResult, PredictionRecord } from "../shared/types";
import { loadPredictionContext } from "./prediction-context-loader";

export async function runPredictionEngine(
  storeId: string,
): Promise<PredictionEngineResult> {
  const context = await loadPredictionContext(storeId);
  const predictions = generatePredictions(context);
  const preventionActions = planPreventionActions(predictions);

  const inventoryRiskCount = countInventorySignals(context);
  const revenueVolatility = computeRevenueVolatility(context);
  const businessStability = computeBusinessStability({
    predictions,
    inventoryRiskCount,
    revenueVolatility,
    patternCount: context.patternSeeds.length,
  });

  await persistPredictionEngine({
    storeId,
    predictions,
    preventionActions,
    businessStability,
  });

  if (predictions.length > 0) {
    await advancePredictionReadiness(storeId, businessStability.score);
  }

  return {
    success: true,
    storeId,
    predictionCount: predictions.length,
    preventionActionCount: preventionActions.length,
    businessStabilityScore: businessStability.score,
    topPrediction: predictions[0] ?? null,
  };
}

async function persistPredictionEngine(input: {
  storeId: string;
  predictions: PredictionRecord[];
  preventionActions: ReturnType<typeof planPreventionActions>;
  businessStability: ReturnType<typeof computeBusinessStability>;
}): Promise<void> {
  const risks = assessPredictionRisks(input.predictions);

  await prisma.$transaction(async (tx) => {
    await tx.prediction.updateMany({
      where: { storeId: input.storeId },
      data: { active: false },
    });
    await tx.preventionAction.updateMany({
      where: { storeId: input.storeId },
      data: { active: false },
    });

    const predictionIdByKey = new Map<string, string>();

    for (const prediction of input.predictions) {
      const row = await tx.prediction.upsert({
        where: {
          storeId_predictionKey: {
            storeId: input.storeId,
            predictionKey: prediction.predictionKey,
          },
        },
        create: mapPredictionCreate(input.storeId, prediction),
        update: mapPredictionUpdate(prediction),
      });
      predictionIdByKey.set(prediction.predictionKey, row.id);

      const confidenceBreakdown = computePredictionConfidence({
        signals: prediction.contributingSignals,
        context: {
          storeId: input.storeId,
          evidenceGroups: new Map(),
          patternSeeds: [],
          merchantBaselines: [],
          rootCauses: [],
          quickWins: [],
          graphStats: { totalNodes: 0, totalEdges: 0 },
        },
        evidenceCount: prediction.evidenceIds.length,
        rootCauseCount: prediction.rootCauseIds.length,
      });

      await tx.predictionConfidence.create({
        data: {
          storeId: input.storeId,
          predictionId: row.id,
          confidenceScore: confidenceBreakdown.confidenceScore,
          signalStrength: confidenceBreakdown.signalStrength,
          historicalSupport: confidenceBreakdown.historicalSupport,
          timelineSupport: confidenceBreakdown.timelineSupport,
          rootCauseSupport: confidenceBreakdown.rootCauseSupport,
          forecastModelSupport: confidenceBreakdown.forecastModelSupport,
          confidenceJson: confidenceBreakdown as Prisma.InputJsonValue,
        },
      });

      await tx.predictionHistory.create({
        data: {
          storeId: input.storeId,
          predictionId: row.id,
          changeType: "generated",
          snapshot: prediction as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const action of input.preventionActions) {
      const resolvedPredictionId = predictionIdByKey.get(action.predictionId);
      if (!resolvedPredictionId) {
        continue;
      }

      await tx.preventionAction.upsert({
        where: {
          storeId_actionKey: {
            storeId: input.storeId,
            actionKey: action.actionKey,
          },
        },
        create: {
          store: { connect: { id: input.storeId } },
          prediction: { connect: { id: resolvedPredictionId } },
          actionKey: action.actionKey,
          actionType: action.actionType,
          title: action.title,
          description: action.description,
          recommendedAction: action.recommendedAction,
          expectedImpactProtected: action.expectedImpactProtected,
          expectedPreventionPct: action.expectedPreventionPct,
          estimatedEffort: action.estimatedEffort,
          estimatedTimeMinutes: action.estimatedTimeMinutes,
          confidence: action.confidence,
          evidenceIds: action.evidenceIds as Prisma.InputJsonValue,
          active: true,
        },
        update: {
          predictionId: resolvedPredictionId,
          actionType: action.actionType,
          title: action.title,
          description: action.description,
          recommendedAction: action.recommendedAction,
          expectedImpactProtected: action.expectedImpactProtected,
          expectedPreventionPct: action.expectedPreventionPct,
          estimatedEffort: action.estimatedEffort,
          estimatedTimeMinutes: action.estimatedTimeMinutes,
          confidence: action.confidence,
          evidenceIds: action.evidenceIds as Prisma.InputJsonValue,
          active: true,
        },
      });
    }

    for (const risk of risks) {
      const predictionId = predictionIdByKey.get(risk.predictionId);
      await tx.riskAssessment.create({
        data: {
          storeId: input.storeId,
          predictionId: predictionId ?? null,
          riskType: risk.riskType,
          riskScore: risk.riskScore,
          riskJson: risk.riskJson as Prisma.InputJsonValue,
        },
      });
    }

    await tx.forecastSnapshot.upsert({
      where: {
        storeId_snapshotKey: {
          storeId: input.storeId,
          snapshotKey: "latest",
        },
      },
      create: {
        store: { connect: { id: input.storeId } },
        snapshotKey: "latest",
        snapshotJson: {
          predictions: input.predictions,
          preventionActions: input.preventionActions,
          businessStability: input.businessStability,
        } as Prisma.InputJsonValue,
        versionNumber: 1,
      },
      update: {
        snapshotJson: {
          predictions: input.predictions,
          preventionActions: input.preventionActions,
          businessStability: input.businessStability,
        } as Prisma.InputJsonValue,
        versionNumber: { increment: 1 },
      },
    });

    await tx.forecastModel.upsert({
      where: {
        storeId_modelKey: {
          storeId: input.storeId,
          modelKey: "deterministic_v1",
        },
      },
      create: {
        store: { connect: { id: input.storeId } },
        modelKey: "deterministic_v1",
        modelType: "trend_extrapolation",
        modelJson: {
          domains: ["inventory", "revenue", "seo", "pricing", "refunds"],
          horizonDays: 30,
        } as Prisma.InputJsonValue,
      },
      update: {
        modelJson: {
          domains: ["inventory", "revenue", "seo", "pricing", "refunds"],
          horizonDays: 30,
          lastRunAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        version: { increment: 1 },
        computedAt: new Date(),
      },
    });

    await tx.businessStability.upsert({
      where: { storeId: input.storeId },
      create: {
        store: { connect: { id: input.storeId } },
        score: input.businessStability.score,
        forecastVolatilityScore: input.businessStability.forecastVolatilityScore,
        inventoryRiskScore: input.businessStability.inventoryRiskScore,
        revenueStabilityScore: input.businessStability.revenueStabilityScore,
        supplierReliabilityScore: input.businessStability.supplierReliabilityScore,
        seasonalUncertaintyScore: input.businessStability.seasonalUncertaintyScore,
        pricingStabilityScore: input.businessStability.pricingStabilityScore,
        trafficConsistencyScore: input.businessStability.trafficConsistencyScore,
        scoreJson: input.businessStability as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
      update: {
        score: input.businessStability.score,
        forecastVolatilityScore: input.businessStability.forecastVolatilityScore,
        inventoryRiskScore: input.businessStability.inventoryRiskScore,
        revenueStabilityScore: input.businessStability.revenueStabilityScore,
        supplierReliabilityScore: input.businessStability.supplierReliabilityScore,
        seasonalUncertaintyScore: input.businessStability.seasonalUncertaintyScore,
        pricingStabilityScore: input.businessStability.pricingStabilityScore,
        trafficConsistencyScore: input.businessStability.trafficConsistencyScore,
        scoreJson: input.businessStability as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
    });
  });
}

function mapPredictionCreate(
  storeId: string,
  prediction: PredictionRecord,
): Prisma.PredictionCreateInput {
  return {
    store: { connect: { id: storeId } },
    predictionKey: prediction.predictionKey,
    predictionType: prediction.predictionType,
    title: prediction.title,
    description: prediction.description,
    forecastWindow: prediction.forecastWindow,
    predictedOutcome: prediction.predictedOutcome,
    predictedValue: prediction.predictedValue,
    predictedUnit: prediction.predictedUnit,
    confidence: prediction.confidence,
    contributingSignals: prediction.contributingSignals as Prisma.InputJsonValue,
    historicalSupport: prediction.historicalSupport as Prisma.InputJsonValue,
    evidenceIds: prediction.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: prediction.graphNodeIds as Prisma.InputJsonValue,
    timelineIds: prediction.timelineIds as Prisma.InputJsonValue,
    rootCauseIds: prediction.rootCauseIds as Prisma.InputJsonValue,
    expectedBusinessImpact: prediction.expectedBusinessImpact,
    rankScore: prediction.rankScore,
    active: true,
    generatedAt: new Date(prediction.generatedAt),
  };
}

function mapPredictionUpdate(prediction: PredictionRecord): Prisma.PredictionUpdateInput {
  return {
    predictionType: prediction.predictionType,
    title: prediction.title,
    description: prediction.description,
    forecastWindow: prediction.forecastWindow,
    predictedOutcome: prediction.predictedOutcome,
    predictedValue: prediction.predictedValue,
    predictedUnit: prediction.predictedUnit,
    confidence: prediction.confidence,
    contributingSignals: prediction.contributingSignals as Prisma.InputJsonValue,
    historicalSupport: prediction.historicalSupport as Prisma.InputJsonValue,
    evidenceIds: prediction.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: prediction.graphNodeIds as Prisma.InputJsonValue,
    timelineIds: prediction.timelineIds as Prisma.InputJsonValue,
    rootCauseIds: prediction.rootCauseIds as Prisma.InputJsonValue,
    expectedBusinessImpact: prediction.expectedBusinessImpact,
    rankScore: prediction.rankScore,
    active: true,
    generatedAt: new Date(prediction.generatedAt),
  };
}

function countInventorySignals(
  context: Awaited<ReturnType<typeof loadPredictionContext>>,
): number {
  const factTypes = ["OutOfStock", "InventoryLow", "InventoryCritical"];
  return factTypes.reduce(
    (sum, factType) => sum + (context.evidenceGroups.get(factType)?.count ?? 0),
    0,
  );
}

function computeRevenueVolatility(
  context: Awaited<ReturnType<typeof loadPredictionContext>>,
): number {
  const revenue = context.merchantBaselines.find((b) => b.baselineType === "revenue");
  const recent = Number(revenue?.baselineJson.recent30DayRevenue ?? 0);
  const prior = Number(revenue?.baselineJson.prior30DayRevenue ?? 0);
  if (prior <= 0) {
    return 0.1;
  }
  return Math.abs(recent - prior) / prior;
}

async function advancePredictionReadiness(
  storeId: string,
  stabilityScore: number,
): Promise<void> {
  await prisma.learningReadiness.upsert({
    where: { storeId },
    create: {
      storeId,
      predictionReady: true,
      merchantMessage:
        "Forecasting is ready. StorePilot can predict risks and recommend prevention actions.",
      stageExplanation:
        "Deterministic predictions were generated from knowledge graph, root causes, and historical intelligence.",
      lastComputedAt: new Date(),
    },
    update: {
      predictionReady: true,
      merchantMessage:
        "Forecasting is ready. StorePilot can predict risks and recommend prevention actions.",
      stageExplanation: `Business Stability score is ${stabilityScore}/100 based on forecast volatility and operational signals.`,
      lastComputedAt: new Date(),
    },
  });
}
