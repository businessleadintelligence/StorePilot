import { describe, expect, it } from "vitest";

import { buildMockGrowthScores } from "./helpers";
import { analyzeRevenueGrowth } from "../../tools/revenue-growth-tool";
import { analyzeAovGrowth } from "../../tools/aov-growth-tool";
import { analyzeRepeatPurchases } from "../../tools/repeat-purchase-tool";
import { analyzeCustomerRetention } from "../../tools/customer-retention-tool";
import { analyzeUpsellOpportunity } from "../../tools/upsell-tool";
import { analyzeCrossSellOpportunity } from "../../tools/cross-sell-tool";
import { analyzeCollectionGrowth } from "../../tools/collection-growth-tool";
import { analyzeCampaignReadiness } from "../../tools/campaign-readiness-tool";
import { analyzeMerchandising } from "../../tools/merchandising-tool";
import { analyzeLandingPageGrowth } from "../../tools/landing-page-growth-tool";
import { analyzeGrowthRisk } from "../../tools/growth-risk-tool";
import {
  calculateGrowthIntelligenceHealthScore,
  classifyGrowthHealthBand,
} from "../../tools/growth-health-tool";
import { rankGrowthRecommendations } from "../../tools/growth-ranking-tool";
import { areGrowthRecommendationsSimilar } from "../../tools/growth-similarity-tool";
import { assignGrowthRecommendationGroup } from "../../tools/growth-group-tool";
import { estimateGrowthImpact } from "../../tools/growth-impact-tool";
import { calculateGrowthIntelligenceScores } from "../../tools/growth-score-tool";

describe("Growth intelligence spec-named tools", () => {
  it("scores declining revenue lower in revenue growth tool", () => {
    const weak = analyzeRevenueGrowth({
      totalRevenue30: 9000,
      previousRevenue30: 12000,
      totalRevenue90: 30000,
    });
    const strong = analyzeRevenueGrowth({
      totalRevenue30: 14000,
      previousRevenue30: 12000,
      totalRevenue90: 39000,
    });
    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.issues).toContain("revenue_declining");
  });

  it("analyzes AOV growth through aov tool", () => {
    const result = analyzeAovGrowth({
      aov30: 28,
      previousAov30: 35,
      itemsPerOrder: 1,
    });
    expect(result.issues).toContain("aov_below_target");
    expect(result.score).toBeLessThan(70);
  });

  it("analyzes repeat purchase strength", () => {
    const result = analyzeRepeatPurchases({
      repeatProductCount: 2,
      totalProductsSold: 12,
      repeatOrderCount: 8,
      totalOrders: 100,
    });
    expect(result.repeatPurchaseRate).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("analyzes retention from returning customer proxy", () => {
    const result = analyzeCustomerRetention({
      returningCustomerRate: 18,
      refundRate: 9,
      repeatPurchaseRate: 14,
    });
    expect(result.retentionScore).toBeLessThan(60);
  });

  it("flags upsell opportunities from basket depth", () => {
    const result = analyzeUpsellOpportunity({
      highVelocityProducts: 4,
      lowBasketDepthOrders: 55,
      totalOrders: 100,
      premiumProductCount: 3,
      medianPrice: 40,
      productsAboveMedian: 5,
    });
    expect(result.upsellOpportunity).toBeGreaterThan(0);
    expect(result.candidateCount).toBeGreaterThan(0);
  });

  it("analyzes cross-sell attach rate", () => {
    const result = analyzeCrossSellOpportunity({
      attachRateProxy: 0.35,
      bundleCandidateCount: 4,
      complementaryPairCount: 3,
      multiItemOrderRate: 40,
    });
    expect(result.crossSellOpportunity).toBeGreaterThan(0);
  });

  it("analyzes collection expansion gaps", () => {
    const result = analyzeCollectionGrowth({
      collectionCount: 3,
      activeProducts: 20,
      productsPerCollection: 4,
      thinCollectionCount: 2,
      missingCollectionDescriptions: 2,
    });
    expect(result.collectionGrowthScore).toBeGreaterThanOrEqual(0);
  });

  it("analyzes campaign readiness composite", () => {
    const result = analyzeCampaignReadiness({
      growthScore: 72,
      inventoryCoverageScore: 80,
      landingPageScore: 66,
      seoScore: 70,
      outOfStockProducts: 1,
      activeProducts: 20,
    });
    expect(result.campaignReadinessScore).toBeGreaterThan(0);
  });

  it("analyzes merchandising mix gaps", () => {
    const result = analyzeMerchandising({
      activeProducts: 20,
      heroProductCount: 3,
      slowMoverCount: 6,
      fastMoverCount: 4,
      collectionCount: 4,
      bundleOpportunityCount: 2,
    });
    expect(result.merchandisingScore).toBeGreaterThanOrEqual(0);
  });

  it("analyzes landing page growth blockers", () => {
    const result = analyzeLandingPageGrowth({
      storeAuditScore: 55,
      conversionIssueCount: 2,
      mobileUxIssueCount: 1,
      homepageIssueCount: 1,
      productPageIssueCount: 1,
    });
    expect(result.landingPageGrowthScore).toBeLessThan(80);
  });

  it("analyzes composite growth risk", () => {
    const result = analyzeGrowthRisk({
      revenueGrowthRate: -15,
      retentionScore: 30,
      growthRiskFromInventory: 45,
      growthRiskFromPricing: 35,
      refundRate: 9,
    });
    expect(result.growthRisk).toBeGreaterThan(30);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("calculates growth health score with penalties", () => {
    const score = calculateGrowthIntelligenceHealthScore({
      scores: buildMockGrowthScores({ growthHealthScore: 80 }),
      criticalIssueCount: 5,
    });
    expect(score).toBeLessThan(80);
    expect(classifyGrowthHealthBand(score)).toBe("watch");
  });

  it("ranks growth recommendations by priority score", () => {
    const ranked = rankGrowthRecommendations([
      { id: "a", priorityScore: 40, confidence: 0.8 },
      { id: "b", priorityScore: 90, confidence: 0.9 },
    ]);
    expect(ranked[0]?.id).toBe("b");
  });

  it("detects similar growth recommendations", () => {
    expect(
      areGrowthRecommendationsSimilar(
        { category: "Upsell", title: "Launch upsell on hero products" },
        { category: "Upsell", title: "Launch upsell on hero products" },
      ),
    ).toBe(true);
  });

  it("assigns retention recommendations to retention group", () => {
    expect(
      assignGrowthRecommendationGroup({
        category: "Retention",
        priorityScore: 50,
        hasDeterministicImpact: false,
      }),
    ).toBe("Retention");
  });

  it("estimates upsell impact", () => {
    const impact = estimateGrowthImpact({
      category: "Upsell",
      confidence: 0.9,
      sectionScore: 55,
    });
    expect(impact.revenueIncrease ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("Growth intelligence tool score boundaries", () => {
  const tools: Array<{ run: () => unknown; field: string }> = [
    {
      run: () =>
        analyzeRevenueGrowth({ totalRevenue30: 0, previousRevenue30: 0, totalRevenue90: 0 }),
      field: "score",
    },
    {
      run: () => analyzeAovGrowth({ aov30: 0, previousAov30: 0, itemsPerOrder: 0 }),
      field: "score",
    },
    {
      run: () =>
        analyzeRepeatPurchases({
          repeatProductCount: 0,
          totalProductsSold: 0,
          repeatOrderCount: 0,
          totalOrders: 0,
        }),
      field: "score",
    },
    {
      run: () =>
        analyzeCustomerRetention({
          returningCustomerRate: 0,
          refundRate: 0,
          repeatPurchaseRate: 0,
        }),
      field: "retentionScore",
    },
    {
      run: () =>
        analyzeUpsellOpportunity({
          highVelocityProducts: 0,
          lowBasketDepthOrders: 0,
          totalOrders: 0,
          premiumProductCount: 0,
          medianPrice: 0,
          productsAboveMedian: 0,
        }),
      field: "upsellOpportunity",
    },
    {
      run: () =>
        analyzeCrossSellOpportunity({
          attachRateProxy: 0,
          bundleCandidateCount: 0,
          complementaryPairCount: 0,
          multiItemOrderRate: 0,
        }),
      field: "crossSellOpportunity",
    },
    {
      run: () =>
        analyzeCollectionGrowth({
          collectionCount: 0,
          activeProducts: 0,
          productsPerCollection: 0,
          thinCollectionCount: 0,
          missingCollectionDescriptions: 0,
        }),
      field: "collectionGrowthScore",
    },
    {
      run: () =>
        analyzeCampaignReadiness({
          growthScore: 0,
          inventoryCoverageScore: 0,
          landingPageScore: 0,
          seoScore: 0,
          outOfStockProducts: 0,
          activeProducts: 0,
        }),
      field: "campaignReadinessScore",
    },
    {
      run: () => {
        const scores = calculateGrowthIntelligenceScores({
          revenue30: 0,
          revenue90: 0,
          revenueGrowthRate: 0,
          aov: 0,
          aovGrowthRate: 0,
          repeatPurchaseRate: 0,
          returningCustomerRate: 0,
          retentionScore: 0,
          upsellOpportunity: 0,
          crossSellOpportunity: 0,
          collectionGrowthScore: 0,
          campaignReadinessScore: 0,
          landingPageGrowthScore: 0,
          merchandisingScore: 0,
          growthRisk: 0,
          seasonalStrength: 0,
          forecastGrowthRate: 0,
          capacityScore: 0,
          estimatedMarginPercent: 42,
        });
        return { score: scores.growthScore };
      },
      field: "score",
    },
  ];

  for (const [index, tool] of tools.entries()) {
    it(`keeps tool ${index + 1} score within 0-100`, () => {
      const result = tool.run() as Record<string, number>;
      const value = result[tool.field];
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
  }
});
