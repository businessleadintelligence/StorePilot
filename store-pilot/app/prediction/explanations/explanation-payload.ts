import type {
  ExplainablePredictionPayload,
  PredictionRecord,
  PreventionActionRecord,
} from "../shared/types";

export function buildExplainablePredictionPayload(input: {
  prediction: PredictionRecord;
  preventionActions: PreventionActionRecord[];
}): ExplainablePredictionPayload {
  return {
    predictionId: input.prediction.id,
    predictionType: input.prediction.predictionType,
    confidence: input.prediction.confidence,
    forecastWindow: input.prediction.forecastWindow,
    predictedOutcome: input.prediction.predictedOutcome,
    contributingSignals: input.prediction.contributingSignals,
    historicalSupport: input.prediction.historicalSupport,
    evidenceIds: input.prediction.evidenceIds,
    graphNodeIds: input.prediction.graphNodeIds,
    timelineIds: input.prediction.timelineIds,
    preventionActions: input.preventionActions.filter(
      (action) => action.predictionId === input.prediction.id,
    ),
    expectedBusinessImpact: input.prediction.expectedBusinessImpact,
  };
}
