import type {
  ContributingSignal,
  PredictionConfidenceBreakdown,
  PredictionContextBundle,
  PredictionRecord,
} from "../shared/types";
import { PREDICTION_DEFINITIONS } from "../shared/constants";
import { extractTrendSignals, hasRequiredSignals } from "../trend-analysis/trend-analyzer";

export function generatePredictions(
  context: PredictionContextBundle,
): PredictionRecord[] {
  const signals = extractTrendSignals(context);
  const active = new Set(signals.map((s) => s.signalKey));
  const aov = getAverageOrderValue(context);
  const predictions: PredictionRecord[] = [];

  for (const definition of PREDICTION_DEFINITIONS) {
    if (!hasRequiredSignals(definition.requiredSignals, active)) {
      continue;
    }

    const outcome = definition.buildOutcome({ context, signals, averageOrderValue: aov });
    const evidenceIds = collectEvidenceIds(context, definition.requiredSignals);
    const rootCauseIds = context.rootCauses
      .filter((cause) => matchesDefinition(definition.predictionType, cause.businessOutcome))
      .map((cause) => cause.id);
    const timelineIds = context.rootCauses.flatMap((cause) =>
      Array.isArray(cause.timeline)
        ? cause.timeline.map((_, index) => `${cause.id}:t${index}`)
        : [],
    );

    const confidenceBreakdown = computePredictionConfidence({
      signals,
      context,
      evidenceCount: evidenceIds.length,
      rootCauseCount: rootCauseIds.length,
    });

    const expectedImpact = estimateBusinessImpact(
      definition.predictionType,
      outcome.predictedValue,
      aov,
      evidenceIds.length,
    );

    const record: PredictionRecord = {
      id: definition.predictionKey,
      predictionKey: definition.predictionKey,
      predictionType: definition.predictionType,
      title: definition.title,
      description: outcome.description,
      forecastWindow: definition.forecastWindow,
      predictedOutcome: outcome.predictedOutcome,
      predictedValue: outcome.predictedValue,
      predictedUnit: outcome.predictedUnit,
      confidence: confidenceBreakdown.confidenceScore,
      contributingSignals: signals.filter((s) =>
        definition.requiredSignals.includes(s.signalKey),
      ),
      historicalSupport: {
        patternCount: context.patternSeeds.length,
        rootCauseCount: rootCauseIds.length,
      },
      evidenceIds,
      graphNodeIds: [],
      timelineIds: timelineIds.slice(0, 20),
      rootCauseIds,
      expectedBusinessImpact: expectedImpact,
      rankScore: 0,
      generatedAt: new Date().toISOString(),
    };

    record.rankScore = computeRankScore(record);
    predictions.push(record);
  }

  return predictions.sort((a, b) => b.rankScore - a.rankScore);
}

function computePredictionConfidence(input: {
  signals: ContributingSignal[];
  context: PredictionContextBundle;
  evidenceCount: number;
  rootCauseCount: number;
}): PredictionConfidenceBreakdown {
  const signalStrength = Math.min(
    0.95,
    input.signals.reduce((sum, s) => sum + s.magnitude, 0) / 20,
  );
  const historicalSupport = Math.min(
    0.95,
    0.4 + input.context.patternSeeds.length * 0.08,
  );
  const timelineSupport = Math.min(0.9, 0.3 + input.rootCauseCount * 0.15);
  const rootCauseSupport = Math.min(0.95, 0.35 + input.rootCauseCount * 0.12);
  const forecastModelSupport = Math.min(
    0.9,
    0.45 + input.context.graphStats.totalNodes / 800,
  );

  const confidenceScore = clamp(
    signalStrength * 0.25 +
      historicalSupport * 0.2 +
      timelineSupport * 0.15 +
      rootCauseSupport * 0.2 +
      forecastModelSupport * 0.1 +
      Math.min(0.15, input.evidenceCount * 0.02),
    0.55,
    0.99,
  );

  return {
    confidenceScore: round(confidenceScore),
    signalStrength: round(signalStrength),
    historicalSupport: round(historicalSupport),
    timelineSupport: round(timelineSupport),
    rootCauseSupport: round(rootCauseSupport),
    forecastModelSupport: round(forecastModelSupport),
  };
}

function computeRankScore(prediction: PredictionRecord): number {
  return round(
    prediction.confidence * 100 * 0.4 +
      Math.min(30, prediction.expectedBusinessImpact / 100) * 0.35 +
      prediction.contributingSignals.length * 5,
  );
}

function estimateBusinessImpact(
  type: string,
  value: number | null,
  aov: number,
  evidenceCount: number,
): number {
  const base = aov * Math.max(1, evidenceCount) * 0.15;
  if (type === "revenue_forecast" && value !== null) {
    return roundCurrency(Math.abs(value / 100) * aov * 30);
  }
  if (type === "inventory_stockout") {
    return roundCurrency(base * 2.5);
  }
  return roundCurrency(base);
}

function collectEvidenceIds(
  context: PredictionContextBundle,
  signalKeys: string[],
): string[] {
  const factMap: Record<string, string[]> = {
    inventory_down: ["OutOfStock", "InventoryLow", "InventoryCritical"],
    seo_down: ["MissingSEO", "MissingMetaDescription"],
    pricing_anomaly: ["MarginRiskCandidate", "PriceAboveCategoryAverage"],
    refund_up: ["RefundRiskSeed"],
    collection_issue: ["OrphanCollection", "SingleProductCollection"],
    revenue_down: [],
    revenue_up: [],
  };
  const ids = new Set<string>();
  for (const key of signalKeys) {
    for (const factType of factMap[key] ?? []) {
      context.evidenceGroups.get(factType)?.evidenceIds.forEach((id) => ids.add(id));
    }
  }
  return [...ids];
}

function matchesDefinition(predictionType: string, outcome: string): boolean {
  const map: Record<string, string[]> = {
    inventory_stockout: ["inventory_shortage"],
    revenue_forecast: ["revenue_decrease", "revenue_increase"],
    seo_traffic_decline: ["traffic_loss", "seo_degradation"],
    pricing_margin_risk: ["pricing_anomaly"],
    refund_increase: ["refund_spike"],
    collection_inactive: ["collection_underperformance"],
    operational_supplier_delay: ["inventory_shortage", "operational_bottleneck"],
  };
  return (map[predictionType] ?? []).includes(outcome);
}

function getAverageOrderValue(context: PredictionContextBundle): number {
  const revenue = context.merchantBaselines.find((b) => b.baselineType === "revenue");
  const aov = revenue?.baselineJson.averageOrderValue;
  return typeof aov === "number" && aov > 0 ? aov : 75;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
function roundCurrency(v: number): number {
  return Math.round(v * 100) / 100;
}

export { computePredictionConfidence };
