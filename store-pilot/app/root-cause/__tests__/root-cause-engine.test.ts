import { describe, expect, it } from "vitest";

import { computeSignalCorrelations } from "../correlation/signal-correlation";
import { buildCausalChain } from "../causal-chain/chain-builder";
import { computeCauseConfidence } from "../confidence/confidence-scorer";
import { assessImpact, severityFromConfidence } from "../impact/impact-assessor";
import { selectTopRootCauses, computeRankScore } from "../ranking/cause-ranking";
import { rejectImpossibleCause, validateOutcomeRule } from "../rules/causal-rules";
import { analyzeSignals, getActiveSignalKeys } from "../signal-analysis/signal-analyzer";
import { buildCausalTimeline } from "../timeline/timeline-builder";
import { reasonAboutRootCauses } from "../reasoning/causal-reasoner";
import { buildExplanationPayload } from "../explanations/explanation-payload";
import { OUTCOME_DETECTION_RULES } from "../shared/constants";
import type { RootCauseContextBundle } from "../shared/types";

function buildContext(): RootCauseContextBundle {
  const evidenceGroups = new Map([
    [
      "OutOfStock",
      { count: 3, evidenceIds: ["e1", "e2", "e3"], avgConfidence: 0.95 },
    ],
    [
      "InventoryLow",
      { count: 2, evidenceIds: ["e4", "e5"], avgConfidence: 0.9 },
    ],
    [
      "MissingSEO",
      { count: 14, evidenceIds: ["e6", "e7"], avgConfidence: 0.88 },
    ],
    [
      "MissingMetaDescription",
      { count: 8, evidenceIds: ["e8"], avgConfidence: 0.85 },
    ],
    [
      "RefundRiskSeed",
      { count: 2, evidenceIds: ["e9"], avgConfidence: 0.82 },
    ],
  ]);

  return {
    storeId: "store-1",
    evidenceGroups,
    patternSeeds: [
      {
        id: "p1",
        patternType: "inventory_pressure",
        semanticLabel: "inventory_stress_signals",
        confidence: 0.88,
        patternJson: { lowStockEvidenceCount: 5, outOfStockEvidenceCount: 3 },
      },
      {
        id: "p2",
        patternType: "order_growth",
        semanticLabel: "revenue_decline_30d",
        confidence: 0.8,
        patternJson: { growthRate: -0.18 },
      },
      {
        id: "p3",
        patternType: "high_refund_rate",
        semanticLabel: "refund_ratio_elevated",
        confidence: 0.86,
        patternJson: { refundRatio: 0.04 },
      },
    ],
    quickWins: [
      {
        id: "qw1",
        winType: "inventory_risk",
        title: "6 inventory risks",
        evidenceIds: ["e1", "e4"],
        sourceFactTypes: ["InventoryLow", "OutOfStock"],
        revenueOpportunity: 960,
        urgency: 82,
        confidence: 0.95,
      },
    ],
    merchantBaselines: [
      {
        id: "b1",
        baselineType: "revenue",
        baselineJson: {
          totalRevenue: 52000,
          recent30DayRevenue: 9000,
          prior30DayRevenue: 11000,
          averageOrderValue: 115,
        },
      },
    ],
    historicalMemory: { version: 2 },
    businessDna: { operationalComplexity: "Moderate" },
    graphStats: { totalNodes: 320, totalEdges: 640 },
  };
}

describe("Root Cause Engine", () => {
  it("analyzes cross-system signals from evidence and patterns", () => {
    const signals = analyzeSignals(buildContext());
    expect(signals.some((signal) => signal.signalKey === "inventory_down")).toBe(true);
    expect(signals.some((signal) => signal.signalKey === "seo_down")).toBe(true);
    expect(signals.some((signal) => signal.signalKey === "revenue_down")).toBe(true);
  });

  it("computes deterministic signal correlations", () => {
    const signals = analyzeSignals(buildContext());
    const correlations = computeSignalCorrelations(signals);
    expect(correlations.length).toBeGreaterThan(0);
    expect(correlations.every((item) => item.strength >= 0.35)).toBe(true);
  });

  it("rejects impossible causal domain combinations", () => {
    expect(
      rejectImpossibleCause({
        primaryCauseDomain: "inventory",
        businessOutcome: "traffic",
      }),
    ).toBe(true);
    expect(
      rejectImpossibleCause({
        primaryCauseDomain: "performance",
        businessOutcome: "refunds",
      }),
    ).toBe(true);
  });

  it("generates causal chains and timelines with evidence", () => {
    const rule = OUTCOME_DETECTION_RULES.find(
      (item) => item.outcome === "inventory_shortage",
    )!;
    const signals = analyzeSignals(buildContext());
    const chain = buildCausalChain({ rule, signals, context: buildContext() });
    const timeline = buildCausalTimeline({
      chain,
      outcomeLabel: "inventory shortage",
    });

    expect(chain.length).toBeGreaterThan(0);
    expect(chain.some((step) => step.evidenceIds.length > 0)).toBe(true);
    expect(timeline.length).toBeGreaterThan(chain.length - 1);
  });

  it("scores confidence deterministically without GPT", () => {
    const breakdown = computeCauseConfidence({
      evidenceIds: ["e1", "e2", "e3"],
      signals: analyzeSignals(buildContext()),
      context: buildContext(),
      patternSupport: 0.85,
    });
    expect(breakdown.confidenceScore).toBeGreaterThanOrEqual(0.35);
    expect(breakdown.confidenceScore).toBeLessThanOrEqual(0.99);
    expect(breakdown.evidenceCount).toBe(3);
  });

  it("reasons about multi-cause scenarios across domains", () => {
    const context = buildContext();
    const signals = analyzeSignals(context);
    const causes = reasonAboutRootCauses({ context, signals });
    const ranked = selectTopRootCauses(causes);

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.some((cause) => cause.businessOutcome === "inventory_shortage")).toBe(
      true,
    );
    expect(ranked.every((cause) => cause.evidenceIds.length >= 0)).toBe(true);
  });

  it("builds structured explanation payloads for GPT", () => {
    const context = buildContext();
    const cause = reasonAboutRootCauses({
      context,
      signals: analyzeSignals(context),
    })[0]!;
    const payload = buildExplanationPayload(cause);
    expect(payload.primaryCause.length).toBeGreaterThan(0);
    expect(payload.confidence).toBeGreaterThan(0);
    expect(payload.causalChain.length).toBeGreaterThan(0);
  });

  it("validates outcome rules against active signals", () => {
    const signals = analyzeSignals(buildContext());
    const active = getActiveSignalKeys(signals);
    const inventoryRule = OUTCOME_DETECTION_RULES.find(
      (rule) => rule.outcome === "inventory_shortage",
    )!;
    expect(validateOutcomeRule(inventoryRule, active)).toBe(true);
  });

  it("assesses impact and severity deterministically", () => {
    const impact = assessImpact({
      revenueOpportunity: 500,
      urgency: 70,
      confidence: 0.9,
      affectedEvidenceCount: 5,
    });
    expect(impact.revenueImpact).toBeGreaterThan(0);
    expect(severityFromConfidence(0.94)).toBe("critical");
  });

  it("ranks causes by composite score", () => {
    const context = buildContext();
    const causes = reasonAboutRootCauses({
      context,
      signals: analyzeSignals(context),
    }).map((cause) => ({ ...cause, rankScore: computeRankScore(cause) }));
    const ranked = selectTopRootCauses(causes);
    for (let index = 1; index < ranked.length; index += 1) {
      expect(ranked[index - 1]!.rankScore).toBeGreaterThanOrEqual(ranked[index]!.rankScore);
    }
  });
});
