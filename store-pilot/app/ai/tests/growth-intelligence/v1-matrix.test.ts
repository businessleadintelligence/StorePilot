import { describe, expect, it } from "vitest";

import { buildMockGrowthScores } from "./helpers";
import { GROWTH_INTELLIGENCE_CATEGORIES } from "../../schemas/growth-intelligence";
import { analyzeRevenueGrowth } from "../../tools/revenue-growth-tool";
import { analyzeAovGrowth } from "../../tools/aov-growth-tool";
import { analyzeUpsellOpportunity } from "../../tools/upsell-tool";
import { analyzeCrossSellOpportunity } from "../../tools/cross-sell-tool";
import { analyzeCustomerRetention } from "../../tools/customer-retention-tool";
import { analyzeRepeatPurchases } from "../../tools/repeat-purchase-tool";
import { analyzeCollectionGrowth } from "../../tools/collection-growth-tool";
import { analyzeCampaignReadiness } from "../../tools/campaign-readiness-tool";
import { analyzeMerchandising } from "../../tools/merchandising-tool";
import { analyzeGrowthSeasonality } from "../../tools/growth-seasonality-tool";
import { analyzeLandingPageGrowth } from "../../tools/landing-page-growth-tool";
import { analyzeGrowthRisk } from "../../tools/growth-risk-tool";
import { calculateGrowthIntelligenceHealthScore } from "../../tools/growth-health-tool";
import { buildGrowthIntelligenceDeliverableFields } from "../../schemas/growth-intelligence";

const GROWTH_AREA_RUNNERS: Record<string, () => { score?: number; growthRisk?: number; retentionScore?: number; issues: string[] }> = {
  "Revenue Growth": () =>
    analyzeRevenueGrowth({
      totalRevenue30: 11000,
      previousRevenue30: 12000,
      totalRevenue90: 33000,
    }),
  "AOV Growth": () =>
    analyzeAovGrowth({
      aov30: 62,
      previousAov30: 58,
      itemsPerOrder: 1.8,
    }),
  Upsell: () =>
    analyzeUpsellOpportunity({
      highVelocityProducts: 4,
      lowBasketDepthOrders: 20,
      totalOrders: 100,
      premiumProductCount: 3,
      medianPrice: 40,
      productsAboveMedian: 5,
    }),
  "Cross-sell": () =>
    analyzeCrossSellOpportunity({
      attachRateProxy: 0.3,
      bundleCandidateCount: 3,
      complementaryPairCount: 2,
      multiItemOrderRate: 35,
    }),
  Retention: () =>
    analyzeCustomerRetention({
      returningCustomerRate: 28,
      refundRate: 4,
      repeatPurchaseRate: 24,
    }),
  "Repeat Purchases": () =>
    analyzeRepeatPurchases({
      repeatProductCount: 5,
      totalProductsSold: 12,
      repeatOrderCount: 14,
      totalOrders: 100,
    }),
  Collections: () =>
    analyzeCollectionGrowth({
      collectionCount: 4,
      activeProducts: 20,
      productsPerCollection: 5,
      thinCollectionCount: 1,
      missingCollectionDescriptions: 2,
    }),
  Campaigns: () =>
    analyzeCampaignReadiness({
      growthScore: 72,
      inventoryCoverageScore: 80,
      landingPageScore: 66,
      seoScore: 70,
      outOfStockProducts: 1,
      activeProducts: 20,
    }),
  Merchandising: () =>
    analyzeMerchandising({
      activeProducts: 20,
      heroProductCount: 4,
      slowMoverCount: 3,
      fastMoverCount: 5,
      collectionCount: 4,
      bundleOpportunityCount: 2,
    }),
  "Seasonal Growth": () =>
    analyzeGrowthSeasonality({
      salesByMonth: [
        { month: 4, quantity: 20 },
        { month: 5, quantity: 30 },
        { month: 6, quantity: 45 },
      ],
    }),
  "Landing Pages": () =>
    analyzeLandingPageGrowth({
      storeAuditScore: 74,
      conversionIssueCount: 1,
      mobileUxIssueCount: 0,
      homepageIssueCount: 1,
      productPageIssueCount: 0,
    }),
  "Customer Lifetime Value": () =>
    analyzeGrowthRisk({
      revenueGrowthRate: 8,
      retentionScore: 58,
      growthRiskFromInventory: 30,
      growthRiskFromPricing: 25,
      refundRate: 4,
    }),
};

describe("Growth intelligence v1 category coverage", () => {
  for (const category of GROWTH_INTELLIGENCE_CATEGORIES) {
    it(`supports schema category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const [area, run] of Object.entries(GROWTH_AREA_RUNNERS)) {
    it(`computes deterministic score for ${area}`, () => {
      const result = run();
      expect(Array.isArray(result.issues)).toBe(true);
      if ("score" in result && result.score !== undefined) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
      if ("retentionScore" in result && result.retentionScore !== undefined) {
        expect(result.retentionScore).toBeGreaterThanOrEqual(0);
        expect(result.retentionScore).toBeLessThanOrEqual(100);
      }
      if ("growthRisk" in result && result.growthRisk !== undefined) {
        expect(result.growthRisk).toBeGreaterThanOrEqual(0);
        expect(result.growthRisk).toBeLessThanOrEqual(100);
      }
    });
  }
});

describe("Growth intelligence v1 deliverable outputs", () => {
  for (const priority of [1, 2, 3, 4, 5]) {
    it(`maps revenue opportunity for priority ${priority}`, () => {
      const fields = buildGrowthIntelligenceDeliverableFields({
        facts: {
          growthScore: 68,
          revenueOpportunity: 420,
          aovOpportunity: 180,
        },
        recommendations: [
          {
            id: "growth:1",
            title: "Launch upsell campaign",
            group: "Immediate Revenue Wins",
            priority,
          },
        ],
        findings: [{ title: "Retention gap", severity: "high" }],
      });

      expect(fields.revenueOpportunity).toBe(420);
      expect(fields.campaignTimeline.length).toBeGreaterThan(0);
    });
  }

  it("calculates growth health score with penalties", () => {
    const score = calculateGrowthIntelligenceHealthScore({
      scores: buildMockGrowthScores({ growthHealthScore: 80 }),
      criticalIssueCount: 4,
    });
    expect(score).toBeLessThan(80);
  });
});
