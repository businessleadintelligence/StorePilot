import type { PredictionRecord } from "../shared/types";

export type RiskAssessmentRecord = {
  riskType: string;
  riskScore: number;
  predictionId: string;
  riskJson: Record<string, unknown>;
};

export function assessPredictionRisks(
  predictions: PredictionRecord[],
): RiskAssessmentRecord[] {
  return predictions
    .filter((prediction) => prediction.confidence >= 0.75)
    .map((prediction) => ({
      predictionId: prediction.id,
      riskType: prediction.predictionType,
      riskScore: Math.round(prediction.confidence * 100),
      riskJson: {
        predictedOutcome: prediction.predictedOutcome,
        expectedBusinessImpact: prediction.expectedBusinessImpact,
        forecastWindow: prediction.forecastWindow,
        signalCount: prediction.contributingSignals.length,
      },
    }));
}
