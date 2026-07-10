import { BUSINESS_STABILITY_WEIGHTS } from "../shared/constants";
import type { BusinessStabilityRecord, PredictionRecord } from "../shared/types";

export function computeBusinessStability(input: {
  predictions: PredictionRecord[];
  inventoryRiskCount: number;
  revenueVolatility: number;
  patternCount: number;
}): BusinessStabilityRecord {
  const forecastVolatilityScore = scoreFromVolatility(input.predictions);
  const inventoryRiskScore = scoreInverse(input.inventoryRiskCount * 8);
  const revenueStabilityScore = scoreInverse(Math.round(input.revenueVolatility * 100));
  const supplierReliabilityScore = scoreInverse(
    input.predictions.some((p) => p.predictionType === "operational_supplier_delay")
      ? 35
      : 15,
  );
  const seasonalUncertaintyScore = scoreInverse(input.patternCount > 2 ? 20 : 10);
  const pricingStabilityScore = scoreInverse(
    input.predictions.some((p) => p.predictionType === "pricing_margin_risk") ? 30 : 12,
  );
  const trafficConsistencyScore = scoreInverse(
    input.predictions.some((p) => p.predictionType === "seo_traffic_decline") ? 28 : 10,
  );

  const weighted =
    forecastVolatilityScore * BUSINESS_STABILITY_WEIGHTS.forecastVolatility +
    inventoryRiskScore * BUSINESS_STABILITY_WEIGHTS.inventoryRisk +
    revenueStabilityScore * BUSINESS_STABILITY_WEIGHTS.revenueStability +
    supplierReliabilityScore * BUSINESS_STABILITY_WEIGHTS.supplierReliability +
    seasonalUncertaintyScore * BUSINESS_STABILITY_WEIGHTS.seasonalUncertainty +
    pricingStabilityScore * BUSINESS_STABILITY_WEIGHTS.pricingStability +
    trafficConsistencyScore * BUSINESS_STABILITY_WEIGHTS.trafficConsistency;

  return {
    score: Math.round(clamp(weighted, 0, 100)),
    forecastVolatilityScore,
    inventoryRiskScore,
    revenueStabilityScore,
    supplierReliabilityScore,
    seasonalUncertaintyScore,
    pricingStabilityScore,
    trafficConsistencyScore,
  };
}

function scoreFromVolatility(predictions: PredictionRecord[]): number {
  if (predictions.length === 0) {
    return 75;
  }
  const highRisk = predictions.filter((p) => p.confidence >= 0.85).length;
  return scoreInverse(highRisk * 12);
}

function scoreInverse(penalty: number): number {
  return Math.round(clamp(100 - penalty, 20, 100));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
