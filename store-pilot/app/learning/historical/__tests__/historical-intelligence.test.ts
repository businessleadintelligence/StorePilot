import { describe, expect, it } from "vitest";

import { buildMerchantBaselines } from "../history-import/merchant-baselines";
import { buildPatternSeeds } from "../pattern-seeds/pattern-seeds";
import {
  buildConfidenceSeeds,
  computeOverallConfidenceFromSeeds,
} from "../confidence-seeds/confidence-seeds";
import { buildBusinessDnaFromHistorical } from "../dna-builder/business-dna-builder";
import { hashHistoricalSnapshot } from "../memory-seeds/historical-memory";
import type { HistoricalAggregationSnapshot } from "../shared/types";

function buildAggregation(
  overrides: Partial<HistoricalAggregationSnapshot> = {},
): HistoricalAggregationSnapshot {
  return {
    productCount: 120,
    activeProductCount: 100,
    orderCount: 450,
    totalRevenue: 52000,
    averageOrderValue: 115.56,
    averageProductPrice: 42.5,
    totalInventoryUnits: 800,
    lowStockEvidenceCount: 8,
    outOfStockEvidenceCount: 3,
    refundRatio: 0.04,
    recent30DayRevenue: 12000,
    prior30DayRevenue: 9000,
    ordersByDayOfWeek: [
      { dayOfWeek: 0, orderCount: 80, revenue: 9000 },
      { dayOfWeek: 1, orderCount: 50, revenue: 5500 },
      { dayOfWeek: 2, orderCount: 55, revenue: 6000 },
      { dayOfWeek: 3, orderCount: 52, revenue: 5800 },
      { dayOfWeek: 4, orderCount: 58, revenue: 6200 },
      { dayOfWeek: 5, orderCount: 60, revenue: 6500 },
      { dayOfWeek: 6, orderCount: 95, revenue: 13000 },
    ],
    evidenceByFactType: {
      InventoryLow: 5,
      OutOfStock: 3,
      PriceChanged: 4,
      SeasonalCandidate: 2,
      RefundRiskSeed: 1,
    },
    topProductTitles: [{ title: "Best Seller", count: 24 }],
    ...overrides,
  };
}

describe("Historical Intelligence Engine", () => {
  describe("merchant baselines", () => {
    it("generates all nine baseline types deterministically", () => {
      const baselines = buildMerchantBaselines(buildAggregation());
      expect(baselines.map((baseline) => baseline.baselineType)).toEqual([
        "revenue",
        "pricing",
        "inventory",
        "category",
        "vendor",
        "seasonality",
        "refund",
        "growth",
        "operational",
      ]);
      expect(baselines[0]?.baselineJson.totalRevenue).toBe(52000);
    });
  });

  describe("pattern seeds", () => {
    it("detects weekend sales lift when weekend exceeds weekday average", () => {
      const patterns = buildPatternSeeds(buildAggregation());
      expect(
        patterns.some((pattern) => pattern.patternType === "weekend_sales_lift"),
      ).toBe(true);
    });

    it("detects high refund rate pattern above threshold", () => {
      const patterns = buildPatternSeeds(buildAggregation({ refundRatio: 0.05 }));
      expect(
        patterns.some((pattern) => pattern.patternType === "high_refund_rate"),
      ).toBe(true);
    });

    it("detects order growth when recent revenue exceeds prior period", () => {
      const patterns = buildPatternSeeds(buildAggregation());
      expect(patterns.some((pattern) => pattern.patternType === "order_growth")).toBe(
        true,
      );
    });
  });

  describe("confidence seeds", () => {
    it("never returns zero confidence after historical synthesis", () => {
      const seeds = buildConfidenceSeeds({
        snapshot: buildAggregation(),
        graphNodeCount: 200,
        graphEdgeCount: 350,
        evidenceCount: 80,
        bootstrapConfidences: {
          inventory: 70,
          products: 68,
          pricing: 50,
          seo: 42,
          collections: 45,
          operations: 58,
          seasonality: 22,
        },
      });
      expect(seeds.every((seed) => seed.confidencePercent > 0)).toBe(true);
      expect(computeOverallConfidenceFromSeeds(seeds)).toBeGreaterThan(50);
    });
  });

  describe("business dna builder", () => {
    it("builds versioned dna profile from graph stats and aggregation", () => {
      const dna = buildBusinessDnaFromHistorical({
        stats: {
          totalNodes: 600,
          totalEdges: 1200,
          averageDegree: 4,
          connectedComponents: 1,
          disconnectedNodes: 0,
          graphDensity: 0.01,
          evidenceCoverage: 0.82,
          businessCoverage: 0.65,
          relationshipCoverage: 0.55,
        },
        snapshot: buildAggregation(),
        patternCount: 4,
        overallConfidencePercent: 78,
      });
      expect(dna.aiConfidencePercent).toBe(78);
      expect(dna.source).toBe("historical_intelligence_engine");
      expect(dna.historicalPatternCount).toBe(4);
    });
  });

  describe("historical snapshots", () => {
    it("produces deterministic snapshot hashes", () => {
      const payload = { version: 1, baselines: { revenue: 100 } };
      expect(hashHistoricalSnapshot(payload)).toBe(hashHistoricalSnapshot(payload));
    });
  });
});
