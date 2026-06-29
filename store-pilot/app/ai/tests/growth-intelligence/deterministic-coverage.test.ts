import { describe, expect, it } from "vitest";

import {
  analyzeGrowthAcquisition,
  analyzeGrowthRetention,
  analyzeGrowthAov,
  analyzeGrowthConversion,
  analyzeGrowthUpsell,
} from "../../tools/growth-section-tool";
import { calculateGrowthIntelligenceHealthScore } from "../../tools/growth-health-tool";
import { calculateGrowthPriorityScore } from "../../tools/growth-ranking-tool";
import { estimateGrowthImpact } from "../../tools/growth-impact-tool";
import { buildGrowthRecommendationGroups } from "../../tools/growth-group-tool";
import { dedupeSimilarGrowthRecommendations } from "../../tools/growth-similarity-tool";
import { validateGrowthIntelligenceEvidenceKeys } from "../../agents/growth-intelligence-evidence";
import { buildMockGrowthScores } from "./helpers";

describe("Growth intelligence deterministic coverage", () => {
  const toolCases = [
    {
      name: "acquisition healthy",
      run: () => analyzeGrowthAcquisition({ totalOrders30: 60, previousOrders30: 45, activeProducts: 12 }),
      assert: (result: ReturnType<typeof analyzeGrowthAcquisition>) => expect(result.score).toBeGreaterThan(50),
    },
    {
      name: "retention healthy",
      run: () => analyzeGrowthRetention({ repeatOrderProxy: 35, refundRate: 3 }),
      assert: (result: ReturnType<typeof analyzeGrowthRetention>) => expect(result.score).toBeGreaterThan(70),
    },
    {
      name: "aov stable",
      run: () => analyzeGrowthAov({ aov: 68, previousAov: 64 }),
      assert: (result: ReturnType<typeof analyzeGrowthAov>) => expect(result.score).toBeGreaterThan(40),
    },
    {
      name: "conversion healthy",
      run: () => analyzeGrowthConversion({ conversionRate: 0.04, averageDiscountPercent: 8 }),
      assert: (result: ReturnType<typeof analyzeGrowthConversion>) => expect(result.score).toBeGreaterThan(40),
    },
    {
      name: "upsell opportunity",
      run: () => analyzeGrowthUpsell({ aov: 72, attachRateProxy: 0.3, fastMoverCount: 4 }),
      assert: (result: ReturnType<typeof analyzeGrowthUpsell>) => expect(result.score).toBeGreaterThan(40),
    },
  ] as const;

  for (const testCase of toolCases) {
    it(`covers ${testCase.name}`, () => {
      const result = testCase.run();
      testCase.assert(result as never);
    });
  }

  it("computes bounded health score", () => {
    const score = calculateGrowthIntelligenceHealthScore({
      scores: buildMockGrowthScores({ growthHealthScore: 100 }),
      criticalIssueCount: 0,
    });

    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(80);
  });

  it("ranks high-confidence recommendations higher", () => {
    const high = calculateGrowthPriorityScore({
      confidence: 0.95,
      difficultyWeight: 1,
      impact: { revenueIncrease: 5, profitIncrease: 4, aovLift: 0.05, retentionLift: 0.1 },
      sectionScore: 40,
    });
    const low = calculateGrowthPriorityScore({
      confidence: 0.2,
      difficultyWeight: 0.85,
      impact: { revenueIncrease: null, profitIncrease: null, aovLift: null, retentionLift: null },
      sectionScore: 85,
    });

    expect(high).toBeGreaterThan(low);
  });

  it("groups recommendations into growth buckets", () => {
    const groups = buildGrowthRecommendationGroups([
      { id: "1", group: "Immediate Revenue Wins" },
      { id: "2", group: "Long-Term Growth" },
    ]);

    expect(groups.immediateRevenueWins).toEqual(["1"]);
    expect(groups.longTermGrowth).toEqual(["2"]);
  });

  it("dedupes growth recommendations by category and title", () => {
    const deduped = dedupeSimilarGrowthRecommendations([
      { category: "Upsell", title: "Launch upsell on hero products", confidence: 0.7 },
      { category: "Upsell", title: "Launch upsell on hero products", confidence: 0.85 },
    ]);

    expect(deduped).toHaveLength(1);
  });

  it("validates evidence keys in catalog map", () => {
    const catalog = [
      {
        key: "growth_health_score",
        label: "Growth health score",
        value: "68/100",
        factPath: "growthHealthScore",
        section: "Overview",
      },
    ];

    expect(() => validateGrowthIntelligenceEvidenceKeys(["growth_health_score"], catalog)).not.toThrow();
    expect(() => validateGrowthIntelligenceEvidenceKeys(["missing"], catalog)).toThrow();
  });

  it("estimates retention impact", () => {
    const impact = estimateGrowthImpact({
      category: "Retention",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.profitIncrease).toBeGreaterThan(0);
  });

  it("estimates upsell impact", () => {
    const impact = estimateGrowthImpact({
      category: "Upsell",
      confidence: 0.75,
      sectionScore: 50,
    });

    expect(impact.revenueIncrease).toBeGreaterThan(0);
    expect(impact.aovLift).toBeGreaterThan(0);
  });
});

describe("Growth intelligence category impact matrix", () => {
  for (const category of [
    "Revenue Growth",
    "AOV Growth",
    "Upsell",
    "Cross-sell",
    "Retention",
    "Repeat Purchases",
    "Collections",
    "Campaigns",
    "Merchandising",
    "Seasonal Growth",
    "Landing Pages",
    "Customer Lifetime Value",
  ] as const) {
    it(`estimates bounded impact for ${category}`, () => {
      const impact = estimateGrowthImpact({
        category,
        confidence: 0.82,
        sectionScore: 48,
      });

      expect(impact).toBeDefined();
      if (["Revenue Growth", "AOV Growth", "Upsell", "Cross-sell", "Campaigns"].includes(category)) {
        expect(impact.revenueIncrease).not.toBeNull();
      }
      if (["Retention", "Repeat Purchases", "Customer Lifetime Value", "Merchandising"].includes(category)) {
        expect(impact.profitIncrease).not.toBeNull();
      }
    });
  }
});

describe("Growth intelligence aov scenarios", () => {
  for (const aov of [35, 45, 55, 65, 75, 85]) {
    it(`scores AOV at $${aov}`, () => {
      const result = analyzeGrowthAov({ aov, previousAov: aov - 5 });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Growth intelligence retention scenarios", () => {
  for (const repeatOrderProxy of [5, 12, 20, 28, 35, 42]) {
    it(`scores repeat proxy at ${repeatOrderProxy}%`, () => {
      const result = analyzeGrowthRetention({ repeatOrderProxy, refundRate: 4 });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Growth intelligence health score matrix", () => {
  for (const criticalIssueCount of [0, 1, 2, 4, 6, 8, 10, 12, 15, 18]) {
    it(`applies health penalty for ${criticalIssueCount} critical issues`, () => {
      const score = calculateGrowthIntelligenceHealthScore({
        scores: buildMockGrowthScores({ growthHealthScore: 75 }),
        criticalIssueCount,
      });
      expect(score).toBeLessThanOrEqual(75);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  }
});
