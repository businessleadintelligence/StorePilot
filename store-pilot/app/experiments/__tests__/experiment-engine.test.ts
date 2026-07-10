import { describe, expect, it } from "vitest";

import { captureExperimentBaseline } from "../baseline/baseline-engine";
import { computeExperimentConfidence } from "../confidence/experiment-confidence";
import { simulateShadowExperiment } from "../execution/shadow-simulator";
import {
  buildExperimentCancelledEvent,
  buildExperimentRejectedEvent,
  buildExperimentStartedEvent,
  buildWinnerSelectedEvent,
} from "../learning/learning-hooks";
import { planExperiments } from "../planner/experiment-planner";
import { detectExperimentOpportunities } from "../recommendations/opportunity-engine";
import { EXPERIMENT_TEMPLATE_DEFINITIONS } from "../shared/constants";
import type { ExperimentContextBundle, ExperimentRecord } from "../shared/types";
import { compareExperimentResults, selectExperimentWinner } from "../winner-selection/winner-selector";

function buildContext(): ExperimentContextBundle {
  const evidenceGroups = new Map([
    ["OutOfStock", { count: 2, evidenceIds: ["e1", "e2"], avgConfidence: 0.95 }],
    ["InventoryLow", { count: 3, evidenceIds: ["e3"], avgConfidence: 0.9 }],
    ["MissingSEO", { count: 12, evidenceIds: ["e4", "e5"], avgConfidence: 0.88 }],
    ["MissingMetaDescription", { count: 8, evidenceIds: ["e6"], avgConfidence: 0.85 }],
    ["MarginRiskCandidate", { count: 2, evidenceIds: ["e7"], avgConfidence: 0.82 }],
    ["OrphanCollection", { count: 1, evidenceIds: ["e8"], avgConfidence: 0.8 }],
  ]);

  return {
    storeId: "store-1",
    currency: "USD",
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
        patternType: "order_growth",
        semanticLabel: "revenue_decline",
        confidence: 0.8,
        patternJson: { growthRate: -0.12 },
      },
    ],
    merchantBaselines: [
      {
        id: "b1",
        baselineType: "revenue",
        baselineJson: {
          recent30DayRevenue: 12000,
          prior30DayRevenue: 14000,
          averageOrderValue: 999,
          conversionRate: 0.028,
        },
      },
      {
        id: "b2",
        baselineType: "pricing",
        baselineJson: { averageMargin: 0.38 },
      },
    ],
    quickWins: [
      {
        id: "qw1",
        winType: "inventory_risk",
        title: "6 inventory risks",
        affectedCount: 6,
        revenueOpportunity: 2400,
        evidenceIds: ["e1", "e3"],
      },
    ],
    rootCauses: [
      {
        id: "rc1",
        businessOutcome: "inventory_shortage",
        primaryCause: "Low stock on Protein Powder",
        confidence: 0.91,
        evidenceIds: ["e1"],
      },
      {
        id: "rc2",
        businessOutcome: "traffic_loss",
        primaryCause: "Missing metadata",
        confidence: 0.87,
        evidenceIds: ["e4"],
      },
    ],
    predictions: [
      {
        id: "pred1",
        predictionKey: "forecast:pricing_margin",
        predictionType: "pricing_margin_risk",
        title: "Margin likely below target",
        confidence: 0.89,
        expectedBusinessImpact: 1800,
        evidenceIds: ["e7"],
      },
      {
        id: "pred2",
        predictionKey: "forecast:seo_traffic",
        predictionType: "seo_traffic_decline",
        title: "Organic traffic expected decline",
        confidence: 0.91,
        expectedBusinessImpact: 2200,
        evidenceIds: ["e4", "e6"],
      },
    ],
    preventionActions: [],
    businessStabilityScore: 72,
    graphStats: { totalNodes: 500, totalEdges: 1200 },
  };
}

describe("Experiment Platform — opportunity engine", () => {
  it("generates evidence-backed opportunities from all intelligence layers", () => {
    const opportunities = detectExperimentOpportunities(buildContext());
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities.every((opp) => opp.evidenceIds.length > 0 || opp.memoryIds.length > 0)).toBe(true);

    const sources = new Set(opportunities.map((opp) => opp.sourceType));
    expect(sources.has("quick_win")).toBe(true);
    expect(sources.has("root_cause")).toBe(true);
    expect(sources.has("prediction")).toBe(true);
  });
});

describe("Experiment Platform — planner and templates", () => {
  it("plans pricing, seo, bundle, and inventory experiments deterministically", () => {
    const context = buildContext();
    const opportunities = detectExperimentOpportunities(context);
    const experiments = planExperiments({ context, opportunities });

    const domains = new Set(experiments.map((exp) => exp.experimentDomain));
    expect(domains.has("pricing")).toBe(true);
    expect(domains.has("seo")).toBe(true);
    expect(domains.has("inventory")).toBe(true);
    expect(EXPERIMENT_TEMPLATE_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("generates deterministic variants for pricing experiments", () => {
    const context = buildContext();
    const opportunities = detectExperimentOpportunities(context);
    const experiments = planExperiments({ context, opportunities });
    const pricing = experiments.find((exp) => exp.experimentDomain === "pricing");
    expect(pricing?.variants.length).toBeGreaterThan(0);
    expect(Number(pricing?.variants[0]?.currentValue)).toBeGreaterThan(0);
  });
});

describe("Experiment Platform — baseline capture", () => {
  it("captures revenue, conversion, ctr, inventory, traffic, seo, refunds, aov, margin", () => {
    const baseline = captureExperimentBaseline(buildContext());
    expect(baseline.revenue).toBeGreaterThan(0);
    expect(baseline.aov).toBe(999);
    expect(baseline.conversion).toBeGreaterThan(0);
    expect(baseline.margin).toBe(0.38);
    expect(baseline.seoScore).toBeGreaterThan(0);
  });
});

describe("Experiment Platform — shadow mode simulation", () => {
  it("simulates expected impact without store changes", () => {
    const context = buildContext();
    const experiments = planExperiments({
      context,
      opportunities: detectExperimentOpportunities(context),
    });
    const experiment = experiments[0]!;
    const shadow = simulateShadowExperiment({ experiment, context });

    expect(shadow.shadowSimulationJson.mode).toBe("shadow");
    expect(shadow.comparisons.length).toBeGreaterThan(0);
    expect(shadow.simulatedObservations.every((obs) => obs.simulated === true)).toBe(true);
  });
});

describe("Experiment Platform — winner selection", () => {
  it("selects winner, loser, no change, and statistical tie deterministically", () => {
    const comparisons = [
      {
        variantKey: "variant:a",
        metricKey: "revenue",
        baselineValue: 1000,
        variantValue: 1050,
        difference: 50,
        differencePct: 5,
        confidence: 0.91,
      },
      {
        variantKey: "variant:b",
        metricKey: "revenue",
        baselineValue: 1000,
        variantValue: 1048,
        difference: 48,
        differencePct: 4.8,
        confidence: 0.89,
      },
    ];

    const winner = selectExperimentWinner(comparisons);
    expect(winner?.outcome).toBe("statistical_tie");

    const clearWinner = selectExperimentWinner([
      { ...comparisons[0]!, differencePct: 12 },
      comparisons[1]!,
    ]);
    expect(clearWinner?.outcome).toBe("winner");

    const noChange = selectExperimentWinner([
      { ...comparisons[0]!, differencePct: 0.5 },
    ]);
    expect(noChange?.outcome).toBe("no_change");

    expect(compareExperimentResults(comparisons)[0]?.variantKey).toBe("variant:a");
  });
});

describe("Experiment Platform — confidence scoring", () => {
  it("scores confidence from observation count, coverage, stability, and memory", () => {
    const context = buildContext();
    const experiment = planExperiments({
      context,
      opportunities: detectExperimentOpportunities(context),
    })[0]!;

    const confidence = computeExperimentConfidence({
      experiment,
      context,
      observationCount: 2,
    });

    expect(confidence.confidenceScore).toBeGreaterThanOrEqual(0.55);
    expect(confidence.historicalSupport).toBeGreaterThan(0);
    expect(confidence.businessStability).toBeGreaterThan(0);
  });
});

describe("Experiment Platform — learning event emission", () => {
  it("emits Sprint 9 learning hook events", () => {
    const experiment: ExperimentRecord = {
      experimentKey: "exp:test",
      experimentDomain: "pricing",
      templateKey: "pricing:price_increase",
      title: "Increase Protein Powder price by 5%",
      businessProblem: "Low elasticity",
      proposedChange: "Increase price by 5%",
      expectedRevenueImpact: 2400,
      expectedProfitImpact: 840,
      confidence: 0.91,
      estimatedDurationDays: 14,
      merchantEffort: 2,
      businessRisk: "low",
      baselineMetrics: captureExperimentBaseline(buildContext()),
      successMetrics: { primaryMetric: "revenue", targetImprovementPct: 5, secondaryMetrics: [] },
      evidenceIds: ["e1"],
      graphNodeIds: [],
      memoryIds: ["p1"],
      predictionIds: [],
      rootCauseIds: ["rc1"],
      recommendationSource: "root_cause",
      shadowSimulationJson: {},
      status: "shadow_simulated",
      rankScore: 80,
      variants: [],
      reason: "Historical pricing suggests low elasticity",
    };

    expect(buildExperimentStartedEvent(experiment).eventType).toBe("ExperimentStarted");
    expect(buildWinnerSelectedEvent(experiment, { variantKey: "variant:a" }).eventType).toBe("WinnerSelected");
    expect(buildExperimentRejectedEvent(experiment).eventType).toBe("ExperimentRejected");
    expect(buildExperimentCancelledEvent(experiment).eventType).toBe("ExperimentCancelled");
  });
});

describe("Experiment Platform — large catalog performance", () => {
  it("processes opportunities incrementally without catalog rescans", () => {
    const context = buildContext();
    const largeEvidence = new Map(context.evidenceGroups);
    for (let i = 0; i < 1000; i++) {
      largeEvidence.set(`SyntheticFact${i}`, {
        count: 1,
        evidenceIds: [`ev-${i}`],
        avgConfidence: 0.8,
      });
    }

    const start = performance.now();
    const opportunities = detectExperimentOpportunities({
      ...context,
      evidenceGroups: largeEvidence,
      graphStats: { totalNodes: 100000, totalEdges: 250000 },
    });
    const experiments = planExperiments({ context, opportunities });
    const elapsed = performance.now() - start;

    expect(opportunities.length).toBeLessThanOrEqual(50);
    expect(experiments.length).toBeLessThanOrEqual(12);
    expect(elapsed).toBeLessThan(500);
  });
});
