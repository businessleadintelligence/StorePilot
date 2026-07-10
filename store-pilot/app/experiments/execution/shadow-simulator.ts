import type {
  ExperimentComparisonResult,
  ExperimentContextBundle,
  ExperimentRecord,
  ExperimentVariantRecord,
} from "../shared/types";

export function simulateShadowExperiment(input: {
  experiment: ExperimentRecord;
  context: ExperimentContextBundle;
}): {
  shadowSimulationJson: Record<string, unknown>;
  comparisons: ExperimentComparisonResult[];
  simulatedObservations: Array<Record<string, unknown>>;
} {
  const { experiment, context } = input;
  const stabilityFactor = context.businessStabilityScore / 100;
  const historicalBoost = Math.min(0.15, experiment.memoryIds.length * 0.03);
  const evidenceBoost = Math.min(0.12, experiment.evidenceIds.length * 0.02);

  const comparisons: ExperimentComparisonResult[] = [];
  const simulatedObservations: Array<Record<string, unknown>> = [];

  for (const variant of experiment.variants.filter((v) => !v.isControl)) {
    const uplift = estimateVariantUplift(experiment, variant, stabilityFactor + historicalBoost + evidenceBoost);
    const metricKey = experiment.successMetrics.primaryMetric;

    const baselineValue = getBaselineMetric(experiment, metricKey);
    const variantValue = baselineValue * (1 + uplift / 100);

    comparisons.push({
      variantKey: variant.variantKey,
      metricKey,
      baselineValue: round(baselineValue),
      variantValue: round(variantValue),
      difference: round(variantValue - baselineValue),
      differencePct: round(uplift),
      confidence: round(experiment.confidence * stabilityFactor),
    });

    simulatedObservations.push({
      variantKey: variant.variantKey,
      revenue: round(experiment.baselineMetrics.revenue * (1 + uplift / 200)),
      conversion: round(experiment.baselineMetrics.conversion * (1 + uplift / 300)),
      margin: round(experiment.baselineMetrics.margin * (1 + uplift / 400)),
      simulated: true,
    });
  }

  return {
    shadowSimulationJson: {
      mode: "shadow",
      stabilityFactor,
      historicalBoost,
      evidenceBoost,
      comparisons,
      expectedRevenueImpact: experiment.expectedRevenueImpact,
      expectedProfitImpact: experiment.expectedProfitImpact,
      simulatedAt: new Date().toISOString(),
    },
    comparisons,
    simulatedObservations,
  };
}

function estimateVariantUplift(
  experiment: ExperimentRecord,
  variant: ExperimentVariantRecord,
  supportFactor: number,
): number {
  const target = experiment.successMetrics.targetImprovementPct;
  const priceDelta =
    Number(variant.proposedValue) > 0 && Number(variant.currentValue) > 0
      ? (Number(variant.proposedValue) - Number(variant.currentValue)) /
        Number(variant.currentValue)
      : 0;

  if (experiment.experimentDomain === "pricing" && priceDelta !== 0) {
    return round(Math.abs(priceDelta) * 100 * experiment.confidence * supportFactor);
  }

  return round(target * experiment.confidence * supportFactor);
}

function getBaselineMetric(experiment: ExperimentRecord, metricKey: string): number {
  const metrics = experiment.baselineMetrics as Record<string, number>;
  return metrics[metricKey] ?? experiment.baselineMetrics.revenue;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
