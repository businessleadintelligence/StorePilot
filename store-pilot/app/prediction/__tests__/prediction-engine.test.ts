import { describe, expect, it } from "vitest";

import { computeBusinessStability } from "../confidence/business-stability-scorer";
import { buildExplainablePredictionPayload } from "../explanations/explanation-payload";
import { generatePredictions, computePredictionConfidence } from "../forecasting/forecast-generator";
import { planPreventionActions } from "../prevention/action-planner";
import { assessPredictionRisks } from "../risk/risk-assessor";
import { PREDICTION_DEFINITIONS } from "../shared/constants";
import type { PredictionContextBundle, PredictionRecord } from "../shared/types";
import {
  extractTrendSignals,
  hasRequiredSignals,
} from "../trend-analysis/trend-analyzer";

function buildContext(overrides?: Partial<PredictionContextBundle>): PredictionContextBundle {
  const evidenceGroups = new Map([
    [
      "OutOfStock",
      { count: 2, evidenceIds: ["e1", "e2"], avgConfidence: 0.95 },
    ],
    [
      "InventoryLow",
      { count: 3, evidenceIds: ["e3", "e4", "e5"], avgConfidence: 0.9 },
    ],
    [
      "MissingSEO",
      { count: 10, evidenceIds: ["e6"], avgConfidence: 0.88 },
    ],
    [
      "MissingMetaDescription",
      { count: 6, evidenceIds: ["e7"], avgConfidence: 0.85 },
    ],
    [
      "RefundRiskSeed",
      { count: 2, evidenceIds: ["e8"], avgConfidence: 0.82 },
    ],
    [
      "MarginRiskCandidate",
      { count: 1, evidenceIds: ["e9"], avgConfidence: 0.8 },
    ],
    [
      "OrphanCollection",
      { count: 2, evidenceIds: ["e10"], avgConfidence: 0.75 },
    ],
  ]);

  return {
    storeId: "store-1",
    evidenceGroups,
    patternSeeds: [
      {
        id: "p1",
        patternType: "inventory_pressure",
        semanticLabel: "inventory_stress",
        confidence: 0.88,
        patternJson: {},
      },
      {
        id: "p2",
        patternType: "high_refund_rate",
        semanticLabel: "refund_elevated",
        confidence: 0.86,
        patternJson: {},
      },
    ],
    merchantBaselines: [
      {
        id: "b1",
        baselineType: "revenue",
        baselineJson: {
          recent30DayRevenue: 8200,
          prior30DayRevenue: 10000,
          averageOrderValue: 75,
        },
      },
    ],
    rootCauses: [
      {
        id: "rc1",
        businessOutcome: "inventory_shortage",
        primaryCause: "Low stock levels",
        confidence: 0.91,
        evidenceIds: ["e1", "e3"],
        timeline: [{ event: "stock_decline" }],
      },
      {
        id: "rc2",
        businessOutcome: "traffic_loss",
        primaryCause: "Missing metadata",
        confidence: 0.87,
        evidenceIds: ["e6"],
        timeline: [{ event: "seo_gap" }],
      },
    ],
    quickWins: [],
    graphStats: { totalNodes: 120, totalEdges: 340 },
    ...overrides,
  };
}

describe("Prediction Engine — trend analysis", () => {
  it("extracts inventory, seo, refund, and revenue signals", () => {
    const signals = extractTrendSignals(buildContext());
    const keys = new Set(signals.map((signal) => signal.signalKey));
    expect(keys.has("inventory_down")).toBe(true);
    expect(keys.has("seo_down")).toBe(true);
    expect(keys.has("refund_up")).toBe(true);
    expect(keys.has("revenue_down")).toBe(true);
  });

  it("requires all definition signals before generating a prediction", () => {
    const active = new Set(["inventory_down"]);
    expect(hasRequiredSignals(["inventory_down"], active)).toBe(true);
    expect(hasRequiredSignals(["inventory_down", "revenue_down"], active)).toBe(false);
  });
});

describe("Prediction Engine — forecasting", () => {
  it("generates deterministic predictions with confidence and evidence", () => {
    const context = buildContext();
    const predictions = generatePredictions(context);
    expect(predictions.length).toBeGreaterThan(0);

    const inventory = predictions.find(
      (prediction) => prediction.predictionType === "inventory_stockout",
    );
    expect(inventory).toBeDefined();
    expect(inventory!.confidence).toBeGreaterThanOrEqual(0.55);
    expect(inventory!.confidence).toBeLessThanOrEqual(0.99);
    expect(inventory!.evidenceIds.length).toBeGreaterThan(0);
    expect(inventory!.predictedOutcome).toMatch(/Stockout in \d+ days/);
  });

  it("covers all seven prediction definitions when signals are present", () => {
    const predictions = generatePredictions(buildContext());
    const types = new Set(predictions.map((prediction) => prediction.predictionType));
    expect(types.has("inventory_stockout")).toBe(true);
    expect(types.has("revenue_forecast")).toBe(true);
    expect(types.has("seo_traffic_decline")).toBe(true);
    expect(types.has("refund_increase")).toBe(true);
    expect(PREDICTION_DEFINITIONS.length).toBe(7);
  });

  it("computes confidence from signals, history, and root causes", () => {
    const context = buildContext();
    const predictions = generatePredictions(context);
    const breakdown = computePredictionConfidence({
      signals: predictions[0]!.contributingSignals,
      context,
      evidenceCount: 5,
      rootCauseCount: 2,
    });
    expect(breakdown.confidenceScore).toBeGreaterThanOrEqual(0.55);
    expect(breakdown.rootCauseSupport).toBeGreaterThan(0);
  });
});

describe("Prediction Engine — prevention", () => {
  it("plans prevention actions with expected impact protected", () => {
    const predictions = generatePredictions(buildContext());
    const actions = planPreventionActions(predictions);
    expect(actions.length).toBeGreaterThan(0);

    const restock = actions.find((action) => action.actionType === "restock");
    expect(restock?.recommendedAction).toMatch(/Order \d+ units today/);
    expect(restock!.expectedImpactProtected).toBeGreaterThan(0);
  });

  it("builds explainable prediction payloads without GPT", () => {
    const predictions = generatePredictions(buildContext());
    const actions = planPreventionActions(predictions);
    const payload = buildExplainablePredictionPayload({
      prediction: predictions[0]!,
      preventionActions: actions,
    });
    expect(payload.predictionId).toBeDefined();
    expect(payload.contributingSignals.length).toBeGreaterThan(0);
    expect(payload.evidenceIds.length).toBeGreaterThan(0);
  });
});

describe("Prediction Engine — business stability", () => {
  it("computes Business Stability score 0-100", () => {
    const predictions = generatePredictions(buildContext());
    const stability = computeBusinessStability({
      predictions,
      inventoryRiskCount: 5,
      revenueVolatility: 0.18,
      patternCount: 2,
    });
    expect(stability.score).toBeGreaterThanOrEqual(0);
    expect(stability.score).toBeLessThanOrEqual(100);
    expect(stability.inventoryRiskScore).toBeGreaterThan(0);
  });

  it("assesses high-confidence prediction risks", () => {
    const predictions = generatePredictions(buildContext()).map((prediction) => ({
      ...prediction,
      confidence: 0.91,
    })) as PredictionRecord[];
    const risks = assessPredictionRisks(predictions);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks[0]!.riskScore).toBeGreaterThanOrEqual(75);
  });
});
