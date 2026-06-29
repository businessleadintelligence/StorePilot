import { describe, expect, it } from "vitest";

import {
  buildSeoConnectorSnapshotFromUnified,
  createEmptyUnifiedStoreMetrics,
  createMockUnifiedStoreMetricsForFacts,
  getBehaviorMetrics,
  getPerformanceMetrics,
  getRevenueMetrics,
  getSeoMetrics,
  getTrafficMetrics,
  INSUFFICIENT_DATA,
  mapLegacyConnectorFields,
} from "../../migration/unified-metrics-migration";
import {
  enforceFactsLayerConnectorIsolation,
  scanFactsLayerForForbiddenConnectorImports,
} from "../../migration/connector-access-guard";
import { buildGrowthIntelligenceFactsFromSnapshot, createMockGrowthIntelligenceSnapshot } from "../growth-intelligence/helpers";
import { buildPricingIntelligenceFactsFromSnapshot, createMockPricingIntelligenceSnapshot } from "../pricing-intelligence/helpers";
import { buildSeoIntelligenceFactsFromSnapshot, createMockSeoIntelligenceSnapshot } from "../seo-intelligence/helpers";
import { buildExecutiveCooFactsFromSnapshot, createMockExecutiveCooSnapshot } from "../executive-coo/helpers";

describe("unified metrics migration layer", () => {
  it("does not allow connector imports inside facts layer", () => {
    const violations = scanFactsLayerForForbiddenConnectorImports();
    expect(violations).toEqual([]);
    expect(() => enforceFactsLayerConnectorIsolation()).not.toThrow();
  });

  it("returns insufficient_data for empty unified metrics", () => {
    const empty = createEmptyUnifiedStoreMetrics();

    expect(getTrafficMetrics(empty)).toEqual({ status: INSUFFICIENT_DATA, value: null });
    expect(getRevenueMetrics(empty)).toEqual({ status: INSUFFICIENT_DATA, value: null });
    expect(getSeoMetrics(empty)).toEqual({ status: INSUFFICIENT_DATA, value: null });
    expect(getPerformanceMetrics(empty)).toEqual({ status: INSUFFICIENT_DATA, value: null });
    expect(getBehaviorMetrics(empty)).toEqual({ status: INSUFFICIENT_DATA, value: null });
  });

  it("maps legacy connector fields deterministically from mock unified metrics", () => {
    const unified = createMockUnifiedStoreMetricsForFacts();
    const mapped = mapLegacyConnectorFields(unified);

    expect(mapped.traffic.status).toBe("available");
    expect(mapped.traffic.value?.sessions).toBe(1200);
    expect(mapped.revenue.status).toBe("available");
    expect(mapped.revenue.value?.revenue).toBe(15000);
    expect(mapped.seo.status).toBe("available");
    expect(mapped.seo.value?.impressions).toBe(6400);
    expect(mapped.performance.status).toBe("available");
    expect(mapped.performance.value?.speedScore).toBe(82);
    expect(mapped.behavior.status).toBe("available");
    expect(mapped.behavior.value?.rageClicks).toBe(18);
  });

  it("builds SEO connector snapshot from unified metrics only", () => {
    const unified = createMockUnifiedStoreMetricsForFacts();
    const snapshot = buildSeoConnectorSnapshotFromUnified(unified, {
      indexedPagesProxy: 42,
      coverageIssues: 2,
    });

    expect(snapshot.dataStatus).toBe("available");
    expect(snapshot.impressionsProxy).toBe(6400);
    expect(snapshot.indexedPagesProxy).toBe(42);
    expect(snapshot.pageSpeedPerformance).toBeGreaterThan(0);
  });

  it("preserves backward-compatible agent fact outputs with unified metrics", async () => {
    const [growthFacts, pricingFacts, seoFacts, executiveFacts] = await Promise.all([
      buildGrowthIntelligenceFactsFromSnapshot(createMockGrowthIntelligenceSnapshot()),
      buildPricingIntelligenceFactsFromSnapshot(createMockPricingIntelligenceSnapshot()),
      buildSeoIntelligenceFactsFromSnapshot(createMockSeoIntelligenceSnapshot()),
      buildExecutiveCooFactsFromSnapshot(createMockExecutiveCooSnapshot()),
    ]);

    expect(growthFacts.growthHealthScore).toBeGreaterThan(0);
    expect(pricingFacts.pricingHealthScore).toBeGreaterThan(0);
    expect(seoFacts.seoHealthScore).toBeGreaterThan(0);
    expect(executiveFacts.operationsHealthScore).toBeGreaterThan(0);
  });
});
