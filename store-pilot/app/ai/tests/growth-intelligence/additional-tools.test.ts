import { describe, expect, it } from "vitest";

import { analyzeGrowthOpportunity } from "../../tools/growth-opportunity-tool";
import { analyzeGrowthCapacity } from "../../tools/growth-capacity-tool";
import { analyzeGrowthRisk } from "../../tools/growth-risk-tool";
import { calculateGrowthRate } from "../../tools/growth-rate-tool";
import {
  analyzeGrowthAcquisition,
  analyzeGrowthRetention,
  analyzeGrowthUpsell,
} from "../../tools/growth-section-tool";
import { classifyGrowthHealthBand } from "../../tools/growth-health-tool";
import { deriveGrowthOverallPriority, deriveGrowthOverallConfidence } from "../../tools/growth-ranking-tool";
import { buildGrowthIntelligenceSubjectKey } from "../../../services/growth-intelligence.server";
import { validateGrowthIntelligenceEvidenceKeys } from "../../agents/growth-intelligence-evidence";

describe("Growth intelligence additional tools", () => {
  it("audits growth opportunity composite", () => {
    const result = analyzeGrowthOpportunity({
      revenueOpportunity: 72,
      upsellOpportunity: 62,
      crossSellOpportunity: 58,
      retentionScore: 48,
      collectionGrowthScore: 55,
      campaignReadinessScore: 60,
    });

    expect(result.totalOpportunityScore).toBeGreaterThan(40);
    expect(result.immediateWinCount).toBeGreaterThan(0);
  });

  it("audits growth capacity constraints", () => {
    const result = analyzeGrowthCapacity({
      activeProducts: 20,
      outOfStockProducts: 4,
      lowStockProducts: 3,
      openGrowthRecommendations: 10,
      implementedRecommendationCount: 2,
    });

    expect(result.capacityScore).toBeGreaterThanOrEqual(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits growth risk composite", () => {
    const result = analyzeGrowthRisk({
      revenueGrowthRate: -12,
      retentionScore: 35,
      growthRiskFromInventory: 40,
      growthRiskFromPricing: 30,
      refundRate: 8,
    });

    expect(result.growthRisk).toBeGreaterThan(30);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("calculates growth rate between periods", () => {
    expect(calculateGrowthRate({ currentPeriod: 120, priorPeriod: 100 })).toBe(20);
    expect(calculateGrowthRate({ currentPeriod: 0, priorPeriod: 0 })).toBe(0);
  });

  it("audits acquisition momentum", () => {
    const result = analyzeGrowthAcquisition({
      totalOrders30: 48,
      previousOrders30: 40,
      activeProducts: 12,
    });

    expect(result.score).toBeGreaterThan(0);
  });

  it("audits retention weakness", () => {
    const result = analyzeGrowthRetention({
      repeatOrderProxy: 12,
      refundRate: 10,
    });

    expect(result.issues).toContain("weak_repeat_purchase");
  });

  it("audits upsell attach gaps", () => {
    const result = analyzeGrowthUpsell({
      aov: 42,
      attachRateProxy: 0.08,
      fastMoverCount: 1,
    });

    expect(result.issues).toContain("weak_upsell_attach");
  });

  it("classifies health bands and overall priority", () => {
    expect(classifyGrowthHealthBand(85)).toBe("strong");
    expect(classifyGrowthHealthBand(65)).toBe("watch");
    expect(classifyGrowthHealthBand(40)).toBe("weak");
    expect(deriveGrowthOverallPriority([90, 70])).toBe(1);
    expect(deriveGrowthOverallConfidence([0.8, 0.6])).toBe(0.7);
  });

  it("builds growth intelligence subject key and evidence keys", () => {
    expect(buildGrowthIntelligenceSubjectKey("store-123")).toBe("growth-intelligence:store-123");

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
});
