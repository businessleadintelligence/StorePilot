import { describe, expect, it } from "vitest";

import { buildBusinessContext, hashBusinessContext } from "../business-context/business-context-builder";
import { buildDecisionsFromContext } from "../decision-engine/decision-builder/decision-builder";
import { selectTopExecutiveDecisions } from "../decision-engine/decision-ranking/decision-ranking";
import { scoreExecutiveDecisions } from "../decision-engine/decision-scoring/decision-scoring";
import { computeOperationalReadiness } from "../executive-score/operational-readiness";
import { convertDecisionsToTasks } from "../operations-queue/task-converter";
import {
  buildDeterministicBriefing,
  buildDeterministicOperatingPlan,
  buildExecutiveCooPrompt,
} from "../prompt-builder/executive-prompt-builder";
import type { DecisionContextBundle } from "../shared/types";

function buildContext(
  overrides: Partial<DecisionContextBundle> = {},
): DecisionContextBundle {
  return {
    storeId: "store-1",
    quickWins: [
      {
        winType: "missing_seo",
        category: "seo",
        title: "14 products missing SEO",
        description: "Missing SEO titles",
        affectedCount: 14,
        businessImpact: 72,
        confidence: 0.9,
        urgency: 45,
        revenueOpportunity: 420,
        rankScore: 68,
        evidenceIds: ["e1", "e2"],
        sourceFactTypes: ["MissingSEO"],
      },
      {
        winType: "inventory_risk",
        category: "inventory",
        title: "6 inventory risks",
        description: "Low stock signals",
        affectedCount: 6,
        businessImpact: 88,
        confidence: 0.95,
        urgency: 82,
        revenueOpportunity: 960,
        rankScore: 85,
        evidenceIds: ["e3"],
        sourceFactTypes: ["InventoryLow", "OutOfStock"],
      },
    ],
    quickWinSummary: {
      totalWins: 2,
      estimatedRevenueOpportunity: 1380,
      headline: "We already found 2 high-impact opportunities",
    },
    patternSeeds: [
      {
        id: "p1",
        patternType: "order_growth",
        semanticLabel: "revenue_growth_30d",
        confidence: 0.82,
        patternJson: { growthRate: 0.15 },
      },
    ],
    confidenceSeeds: [
      { domain: "inventory", confidencePercent: 78 },
      { domain: "seo", confidencePercent: 65 },
      { domain: "pricing", confidencePercent: 58 },
    ],
    merchantBaselines: [
      {
        baselineType: "revenue",
        baselineJson: { totalRevenue: 52000, averageOrderValue: 115 },
      },
    ],
    businessDna: { operationalComplexity: "Moderate" },
    historicalMemory: { version: 1 },
    learningReadiness: {
      stage: "operational",
      overallConfidencePercent: 72,
      executiveCooReady: false,
      predictionReady: false,
      experimentReady: false,
      merchantIntelligenceReady: false,
    },
    learningPriorities: [
      { domain: "inventory", priorityOrder: 1 },
      { domain: "seo", priorityOrder: 2 },
    ],
    graphStats: { totalNodes: 250, totalEdges: 480 },
    ...overrides,
  };
}

describe("Executive Decision Engine", () => {
  it("generates structured decisions from quick wins and patterns", () => {
    const context = buildContext();
    const decisions = buildDecisionsFromContext(context);
    expect(decisions.length).toBeGreaterThanOrEqual(3);
    expect(decisions.every((decision) => decision.recommendation.length > 0)).toBe(true);
    expect(decisions.every((decision) => decision.sourceEngine.length > 0)).toBe(true);
  });

  it("scores and ranks decisions deterministically", () => {
    const context = buildContext();
    const scored = scoreExecutiveDecisions(buildDecisionsFromContext(context), context);
    const ranked = selectTopExecutiveDecisions(scored);

    expect(["inventory", "risk"]).toContain(ranked[0]?.category);
    expect(ranked.every((decision) => decision.rankScore > 0)).toBe(true);
  });

  it("computes operational readiness score 0-100", () => {
    const readiness = computeOperationalReadiness(buildContext());
    expect(readiness.score).toBeGreaterThanOrEqual(0);
    expect(readiness.score).toBeLessThanOrEqual(100);
    expect(readiness.inventoryScore).toBe(78);
  });

  it("builds reusable business context without raw shopify records", () => {
    const context = buildContext();
    const decisions = selectTopExecutiveDecisions(
      scoreExecutiveDecisions(buildDecisionsFromContext(context), context),
    );
    const readiness = computeOperationalReadiness(context);
    const businessContext = buildBusinessContext({
      context,
      decisions,
      operationalReadiness: readiness,
    });

    expect(businessContext.priorityDecisions.length).toBeGreaterThan(0);
    expect(businessContext.businessSummary).toBeTruthy();
    expect(hashBusinessContext(businessContext)).toHaveLength(64);
  });

  it("converts decisions into operations queue tasks", () => {
    const context = buildContext();
    const decisions = selectTopExecutiveDecisions(
      scoreExecutiveDecisions(buildDecisionsFromContext(context), context),
    );
    const tasks = convertDecisionsToTasks(decisions);
    expect(tasks.length).toBe(decisions.length);
    expect(tasks[0]?.evidenceIds.length).toBeGreaterThan(0);
  });

  it("builds compact executive COO prompt and deterministic payloads", () => {
    const context = buildContext();
    const decisions = selectTopExecutiveDecisions(
      scoreExecutiveDecisions(buildDecisionsFromContext(context), context),
    );
    const readiness = computeOperationalReadiness(context);
    const businessContext = buildBusinessContext({
      context,
      decisions,
      operationalReadiness: readiness,
    });

    const prompt = buildExecutiveCooPrompt(businessContext);
    expect(prompt.length).toBeGreaterThan(50);

    const briefing = buildDeterministicBriefing(businessContext);
    expect(briefing.sections.length).toBeGreaterThan(0);
    expect(briefing.todaysFocus.length).toBeGreaterThan(0);

    const plan = buildDeterministicOperatingPlan(decisions);
    expect(plan.taskCount).toBeGreaterThan(0);
    expect(plan.estimatedRevenueOpportunity).toBeGreaterThan(0);
  });
});
