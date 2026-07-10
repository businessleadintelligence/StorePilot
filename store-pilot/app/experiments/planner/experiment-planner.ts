import {
  EXPERIMENT_TEMPLATE_DEFINITIONS,
  MAX_EXPERIMENTS_PER_RUN,
  SHADOW_MODE_STATUS,
} from "../shared/constants";
import type {
  ExperimentContextBundle,
  ExperimentOpportunityRecord,
  ExperimentRecord,
} from "../shared/types";
import { captureExperimentBaseline } from "../baseline/baseline-engine";

export function planExperiments(input: {
  context: ExperimentContextBundle;
  opportunities: ExperimentOpportunityRecord[];
}): ExperimentRecord[] {
  const baseline = captureExperimentBaseline(input.context);
  const experiments: ExperimentRecord[] = [];

  for (const opportunity of input.opportunities.slice(0, MAX_EXPERIMENTS_PER_RUN)) {
    const template =
      EXPERIMENT_TEMPLATE_DEFINITIONS.find(
        (item) => item.templateKey === opportunity.templateKey,
      ) ??
      EXPERIMENT_TEMPLATE_DEFINITIONS.find(
        (item) =>
          item.domain === opportunity.domain &&
          item.requiredSourceTypes.includes(opportunity.sourceType),
      );

    if (!template) {
      continue;
    }

    const built = template.buildExperiment({
      opportunity,
      context: input.context,
      baseline,
    });

    const experiment: ExperimentRecord = {
      experimentKey: `exp:${opportunity.opportunityKey}`,
      ...built,
      status: SHADOW_MODE_STATUS,
      rankScore: computeRankScore(built),
      shadowSimulationJson: {},
    };
    experiments.push(experiment);
  }

  return experiments.sort((a, b) => b.rankScore - a.rankScore);
}

function computeRankScore(
  experiment: Omit<ExperimentRecord, "experimentKey" | "rankScore" | "status" | "shadowSimulationJson">,
): number {
  return round(
    experiment.confidence * 100 * 0.35 +
      Math.min(40, experiment.expectedRevenueImpact / 100) * 0.35 +
      (10 - experiment.merchantEffort) * 2 +
      (experiment.businessRisk === "low" ? 10 : experiment.businessRisk === "medium" ? 5 : 0),
  );
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
