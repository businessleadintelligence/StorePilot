import { describe, expect, it } from "vitest";

import { analyzePricingElasticity } from "../../tools/pricing-elasticity-tool";
import { analyzePricingPsychology } from "../../tools/pricing-psychology-tool";
import { analyzePricingPremium } from "../../tools/pricing-premium-tool";
import { analyzePricingCompetition } from "../../tools/pricing-competition-tool";
import { analyzePricingDemand } from "../../tools/pricing-demand-tool";
import { analyzePricingProfit } from "../../tools/pricing-profit-tool";
import { classifyPricingHealthBand } from "../../tools/pricing-health-tool";
import { derivePricingOverallPriority, derivePricingOverallConfidence } from "../../tools/pricing-ranking-tool";
import { buildPricingIntelligenceSubjectKey } from "../../../services/pricing-intelligence.server";
import { validatePricingIntelligenceEvidenceKeys } from "../../agents/pricing-intelligence-evidence";

describe("Pricing intelligence additional tools", () => {
  it("audits elasticity and price sensitivity", () => {
    const result = analyzePricingElasticity({
      averageDiscountPercent: 28,
      velocityTrend: 0.2,
      conversionRate: 0.02,
    });

    expect(result.priceSensitive).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits psychological pricing endings", () => {
    const result = analyzePricingPsychology({ prices: [10, 25, 40, 60, 100] });

    expect(result.opportunityCount).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits premium positioning readiness", () => {
    const result = analyzePricingPremium({
      highVelocityProducts: 5,
      lowDiscountProducts: 6,
      averageMarginPercent: 42,
      totalProducts: 12,
    });

    expect(result.opportunityCount).toBeGreaterThan(0);
  });

  it("audits competitive underpricing", () => {
    const result = analyzePricingCompetition({
      medianPrice: 45,
      prices: [15, 20, 45, 50, 120],
    });

    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits demand strength signals", () => {
    const result = analyzePricingDemand({
      totalUnitsSold: 120,
      totalProducts: 10,
      velocity: 3.2,
    });

    expect(result.demandScore).toBeGreaterThan(30);
  });

  it("audits profit decline risk", () => {
    const result = analyzePricingProfit({
      grossProfit: 2800,
      previousGrossProfit: 4200,
      marginPercent: 26,
    });

    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("classifies health bands and overall priority", () => {
    expect(classifyPricingHealthBand(85)).toBe("strong");
    expect(classifyPricingHealthBand(65)).toBe("watch");
    expect(classifyPricingHealthBand(40)).toBe("weak");
    expect(derivePricingOverallPriority([90, 70])).toBe(1);
    expect(derivePricingOverallConfidence([0.8, 0.6])).toBe(0.7);
  });

  it("builds pricing intelligence subject key and evidence keys", async () => {
    expect(buildPricingIntelligenceSubjectKey("store-123")).toBe("pricing-intelligence:store-123");

    const catalog = [
      {
        key: "pricing_health_score",
        label: "Pricing health score",
        value: "68/100",
        factPath: "pricingHealthScore",
        section: "Overview",
      },
    ];

    expect(() => validatePricingIntelligenceEvidenceKeys(["pricing_health_score"], catalog)).not.toThrow();
    expect(() => validatePricingIntelligenceEvidenceKeys(["missing"], catalog)).toThrow();
  });
});
