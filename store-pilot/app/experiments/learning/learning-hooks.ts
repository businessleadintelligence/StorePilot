import type { ExperimentEventType } from "@prisma/client";

import type { ExperimentLearningEvent, ExperimentRecord } from "../shared/types";

export type ExperimentEventEmitter = {
  emit: (event: ExperimentLearningEvent) => void;
};

export function createExperimentEventEmitter(
  onEmit: (event: ExperimentLearningEvent) => void,
): ExperimentEventEmitter {
  return { emit: onEmit };
}

export function buildExperimentStartedEvent(
  experiment: ExperimentRecord,
): ExperimentLearningEvent {
  return buildEvent("ExperimentStarted", experiment);
}

export function buildExperimentCompletedEvent(
  experiment: ExperimentRecord,
  winnerJson: Record<string, unknown>,
): ExperimentLearningEvent {
  return buildEvent("ExperimentCompleted", experiment, winnerJson);
}

export function buildWinnerSelectedEvent(
  experiment: ExperimentRecord,
  winnerJson: Record<string, unknown>,
): ExperimentLearningEvent {
  return buildEvent("WinnerSelected", experiment, winnerJson);
}

export function buildExperimentRejectedEvent(
  experiment: ExperimentRecord,
): ExperimentLearningEvent {
  return buildEvent("ExperimentRejected", experiment);
}

export function buildExperimentCancelledEvent(
  experiment: ExperimentRecord,
): ExperimentLearningEvent {
  return buildEvent("ExperimentCancelled", experiment);
}

function buildEvent(
  eventType: ExperimentEventType,
  experiment: ExperimentRecord,
  extra: Record<string, unknown> = {},
): ExperimentLearningEvent {
  return {
    eventType,
    experimentKey: experiment.experimentKey,
    eventJson: {
      experimentDomain: experiment.experimentDomain,
      templateKey: experiment.templateKey,
      expectedRevenueImpact: experiment.expectedRevenueImpact,
      confidence: experiment.confidence,
      ...extra,
    },
    memoryIds: experiment.memoryIds,
    evidenceIds: experiment.evidenceIds,
  };
}

// Sprint 9: Outcome Learning consumes events from experiment_learning table.
export type OutcomeLearningHook = {
  onExperimentEvent: (event: ExperimentLearningEvent) => Promise<void>;
};

export const noopOutcomeLearningHook: OutcomeLearningHook = {
  onExperimentEvent: async () => undefined,
};
