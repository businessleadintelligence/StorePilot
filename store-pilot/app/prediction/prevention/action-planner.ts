import type { PreventionActionType } from "@prisma/client";

import { PREVENTION_TEMPLATES } from "../shared/constants";
import type { PredictionRecord, PreventionActionRecord } from "../shared/types";

export function planPreventionActions(
  predictions: PredictionRecord[],
): PreventionActionRecord[] {
  const actions: PreventionActionRecord[] = [];

  for (const prediction of predictions) {
    const template = PREVENTION_TEMPLATES[prediction.predictionType];
    if (!template) {
      continue;
    }

    const affectedCount = prediction.contributingSignals.reduce(
      (sum, signal) => sum + signal.magnitude,
      0,
    );
    const built = template.buildAction({
      predictedValue: prediction.predictedValue,
      expectedBusinessImpact: prediction.expectedBusinessImpact,
      affectedCount,
    });

    actions.push({
      id: `prevention:${prediction.predictionKey}`,
      predictionId: prediction.id,
      actionKey: `prevention:${prediction.predictionKey}`,
      actionType: template.actionType,
      title: template.title,
      description: prediction.description,
      recommendedAction: built.recommendedAction,
      expectedImpactProtected: roundCurrency(built.expectedImpactProtected),
      expectedPreventionPct: built.expectedPreventionPct,
      estimatedEffort: prediction.predictionType === "inventory_stockout" ? 2 : 1,
      estimatedTimeMinutes:
        prediction.predictionType === "inventory_stockout" ? 45 : 25,
      confidence: prediction.confidence,
      evidenceIds: prediction.evidenceIds,
    });
  }

  return actions;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapActionTypeLabel(type: PreventionActionType): string {
  return type.replace(/_/g, " ");
}
