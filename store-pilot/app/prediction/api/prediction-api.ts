import prisma from "../../db.server";
import type { PredictionUiItem } from "../shared/types";

export async function getPredictions(storeId: string) {
  return prisma.prediction.findMany({
    where: { storeId, active: true },
    orderBy: [{ rankScore: "desc" }],
    take: 20,
    include: {
      preventionActions: {
        where: { active: true },
        take: 1,
      },
    },
  });
}

export async function getBusinessStability(storeId: string) {
  return prisma.businessStability.findUnique({ where: { storeId } });
}

export async function getPreventionActions(storeId: string) {
  return prisma.preventionAction.findMany({
    where: { storeId, active: true },
    orderBy: { expectedImpactProtected: "desc" },
    include: { prediction: true },
  });
}

export async function getForecastSnapshot(storeId: string) {
  return prisma.forecastSnapshot.findUnique({
    where: {
      storeId_snapshotKey: { storeId, snapshotKey: "latest" },
    },
  });
}

export async function getPredictionUiItems(storeId: string): Promise<PredictionUiItem[]> {
  const predictions = await getPredictions(storeId);
  return predictions.slice(0, 8).map((prediction) => ({
    predictionId: prediction.id,
    predictionType: prediction.predictionType,
    title: prediction.title,
    predictedOutcome: prediction.predictedOutcome,
    confidencePercent: Math.round(Number(prediction.confidence) * 100),
    forecastWindow: prediction.forecastWindow,
    expectedBusinessImpact: Number(prediction.expectedBusinessImpact),
    preventionAction: prediction.preventionActions[0]?.recommendedAction ?? null,
    expectedImpactProtected: prediction.preventionActions[0]
      ? Number(prediction.preventionActions[0].expectedImpactProtected)
      : 0,
  }));
}

export async function getTopRiskPredictions(storeId: string, limit = 3) {
  const items = await getPredictionUiItems(storeId);
  const priorityTypes = new Set([
    "revenue_forecast",
    "seo_traffic_decline",
    "refund_increase",
    "inventory_stockout",
  ]);
  return items
    .filter((item) => priorityTypes.has(item.predictionType))
    .slice(0, limit);
}
