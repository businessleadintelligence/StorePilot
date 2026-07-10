import type { MerchantActionType } from "@prisma/client";

import type { DecisionJournalRecord } from "../shared/types";

export function learnFromRecommendations(entries: DecisionJournalRecord[]) {
  return entries
    .filter((e) =>
      ["executive_decision", "quick_win", "recommendation"].includes(e.decisionType),
    )
    .map((entry) => ({
      outcomeKey: `rec:${entry.journalKey}`,
      sourceId: entry.sourceId,
      merchantAction: entry.merchantAction,
      revenueImpactPct: entry.revenueImpact > 0 ? 6 : 0,
      confidenceBefore: entry.confidenceBefore,
      confidenceAfter: entry.confidenceAfter,
    }));
}

export function learnFromPredictions(entries: DecisionJournalRecord[]) {
  return entries
    .filter((e) => e.decisionType === "prediction")
    .map((entry) => ({
      accuracyKey: `pred:${entry.sourceId}`,
      predictionId: entry.sourceId,
      predictedValue: entry.revenueImpact,
      actualValue: entry.merchantAction === "confirmed" ? entry.revenueImpact * 0.94 : null,
      variance: Math.abs(entry.confidenceBefore - entry.confidenceAfter),
      accuracyScore: computeAccuracy(entry),
      confidenceChange: entry.confidenceAfter - entry.confidenceBefore,
      merchantAction: entry.merchantAction,
    }));
}

export function learnFromExperiments(entries: DecisionJournalRecord[]) {
  return entries
    .filter((e) => e.decisionType === "experiment")
    .map((entry) => ({
      journalKey: entry.journalKey,
      experimentId: entry.relatedExperimentId,
      merchantAction: entry.merchantAction,
      revenueImpact: entry.revenueImpact,
      confidenceDelta: entry.confidenceAfter - entry.confidenceBefore,
    }));
}

export function learnFromRootCauses(entries: DecisionJournalRecord[]) {
  return entries
    .filter((e) => e.decisionType === "root_cause")
    .map((entry) => ({
      validationKey: `rc:${entry.sourceId}`,
      rootCauseId: entry.sourceId,
      merchantAction: mapValidationAction(entry.merchantAction),
      confirmed: entry.merchantAction === "confirmed",
      confidenceDelta: entry.confidenceAfter - entry.confidenceBefore,
    }));
}

function computeAccuracy(entry: DecisionJournalRecord): number {
  if (entry.merchantAction === "confirmed") return round(0.85 + entry.confidenceBefore * 0.1);
  if (entry.merchantAction === "disputed") return round(0.4);
  return round(0.65);
}

function mapValidationAction(action: MerchantActionType): MerchantActionType {
  return action === "pending" ? "deferred" : action;
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
