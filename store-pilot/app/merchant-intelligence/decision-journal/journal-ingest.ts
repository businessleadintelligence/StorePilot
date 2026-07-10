import type { MerchantActionType } from "@prisma/client";

import type {
  DecisionJournalRecord,
  MerchantIntelligenceContext,
} from "../shared/types";

const EVENT_TO_ACTION: Record<string, MerchantActionType> = {
  ExperimentStarted: "approved",
  ExperimentCompleted: "accepted",
  WinnerSelected: "accepted",
  ExperimentRejected: "dismissed",
  ExperimentCancelled: "cancelled",
};

export function ingestIntelligenceEvents(
  context: MerchantIntelligenceContext,
): DecisionJournalRecord[] {
  const entries: DecisionJournalRecord[] = [];

  for (const event of context.experimentEvents) {
    entries.push({
      journalKey: `journal:experiment:${event.experimentId}:${event.eventType}`,
      decisionType: "experiment",
      sourceId: event.experimentId,
      title: `Experiment ${event.eventType}`,
      recommendation: String(event.eventJson.recommendedAction ?? event.eventJson.title ?? ""),
      evidenceIds: event.evidenceIds,
      graphNodeIds: [],
      memoryIds: event.memoryIds,
      merchantAction: EVENT_TO_ACTION[event.eventType] ?? "pending",
      businessContext: event.eventJson,
      outcome: String(event.eventJson.expectedRevenueImpact ?? ""),
      revenueImpact: Number(event.eventJson.expectedRevenueImpact ?? 0),
      profitImpact: Number(event.eventJson.expectedProfitImpact ?? 0),
      confidenceBefore: Number(event.eventJson.confidence ?? 0.5),
      confidenceAfter: computeConfidenceAfter(
        Number(event.eventJson.confidence ?? 0.5),
        EVENT_TO_ACTION[event.eventType] ?? "pending",
      ),
      relatedRootCauseId: "",
      relatedPredictionId: "",
      relatedExperimentId: event.experimentId,
    });
  }

  for (const decision of context.executiveDecisions) {
    entries.push({
      journalKey: `journal:executive:${decision.id}`,
      decisionType: "executive_decision",
      sourceId: decision.id,
      title: decision.title,
      recommendation: decision.title,
      evidenceIds: decision.evidenceIds,
      graphNodeIds: [],
      memoryIds: [],
      merchantAction: "pending",
      businessContext: { category: decision.category },
      outcome: "",
      revenueImpact: 0,
      profitImpact: 0,
      confidenceBefore: decision.confidence,
      confidenceAfter: decision.confidence,
      relatedRootCauseId: "",
      relatedPredictionId: "",
      relatedExperimentId: "",
    });
  }

  for (const prediction of context.predictions) {
    entries.push({
      journalKey: `journal:prediction:${prediction.predictionKey}`,
      decisionType: "prediction",
      sourceId: prediction.predictionKey,
      title: `Prediction ${prediction.predictionKey}`,
      recommendation: "",
      evidenceIds: [],
      graphNodeIds: [],
      memoryIds: [],
      merchantAction: "pending",
      businessContext: {},
      outcome: "",
      revenueImpact: prediction.expectedBusinessImpact,
      profitImpact: prediction.expectedBusinessImpact * 0.35,
      confidenceBefore: prediction.confidence,
      confidenceAfter: prediction.confidence,
      relatedRootCauseId: "",
      relatedPredictionId: prediction.predictionKey,
      relatedExperimentId: "",
    });
  }

  for (const cause of context.rootCauses) {
    entries.push({
      journalKey: `journal:root_cause:${cause.id}`,
      decisionType: "root_cause",
      sourceId: cause.id,
      title: cause.primaryCause,
      recommendation: cause.primaryCause,
      evidenceIds: [],
      graphNodeIds: [],
      memoryIds: [],
      merchantAction: "pending",
      businessContext: { businessOutcome: cause.businessOutcome },
      outcome: "",
      revenueImpact: 0,
      profitImpact: 0,
      confidenceBefore: cause.confidence,
      confidenceAfter: cause.confidence,
      relatedRootCauseId: cause.id,
      relatedPredictionId: "",
      relatedExperimentId: "",
    });
  }

  return entries;
}

function computeConfidenceAfter(
  before: number,
  action: MerchantActionType,
): number {
  const delta =
    action === "accepted" || action === "approved" || action === "confirmed"
      ? 0.05
      : action === "dismissed" || action === "rejected"
        ? -0.03
        : 0;
  return round(clamp(before + delta, 0.1, 0.99));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
