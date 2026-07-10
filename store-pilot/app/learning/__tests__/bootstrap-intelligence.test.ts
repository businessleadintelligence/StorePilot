import { describe, expect, it } from "vitest";

import { classifyStoreSize, estimateCatalogComplexity } from "../bootstrap/catalog-estimator/catalog-estimator";
import { estimateLearningDurations } from "../bootstrap/learning-estimator/learning-estimator";
import { buildLearningPriorities, sortByLearningPriority } from "../bootstrap/learning-prioritizer/learning-prioritizer";
import { buildLearningEta, formatEtaMinutes } from "../eta/learning-eta";
import {
  assignLearningVelocities,
  computeInitialConfidences,
  computeOverallConfidence,
  resolveBootstrapStage,
} from "../readiness/initial-confidence";
import type { StoreCatalogSnapshot } from "../shared/types";

function buildSnapshot(overrides: Partial<StoreCatalogSnapshot> = {}): StoreCatalogSnapshot {
  return {
    productsCount: 250,
    variantsCount: 600,
    collectionsCount: 12,
    ordersCount: 1200,
    inventoryItemsCount: 600,
    locationsCount: 2,
    vendorsCount: 8,
    uniqueTagsCount: 40,
    averageVariantsPerProduct: 2.4,
    oldestOrderAt: new Date("2024-01-01T00:00:00.000Z"),
    newestOrderAt: new Date("2025-06-01T00:00:00.000Z"),
    storeCreatedAt: new Date("2023-06-01T00:00:00.000Z"),
    estimatedHistoryMonths: 18,
    storeAgeDays: 700,
    ...overrides,
  };
}

describe("Bootstrap Intelligence Platform", () => {
  describe("store profiling and sizing", () => {
    it("classifies store size tiers deterministically", () => {
      expect(classifyStoreSize(20)).toBe("tiny");
      expect(classifyStoreSize(200)).toBe("small");
      expect(classifyStoreSize(2000)).toBe("medium");
      expect(classifyStoreSize(12000)).toBe("large");
      expect(classifyStoreSize(40000)).toBe("enterprise");
    });

    it("estimates catalog complexity scores", () => {
      const scores = estimateCatalogComplexity(buildSnapshot());
      expect(scores.catalogComplexityScore).toBeGreaterThan(0);
      expect(scores.historicalDepthScore).toBeGreaterThan(0);
      expect(scores.operationalComplexityScore).toBeGreaterThan(0);
    });
  });

  describe("learning estimator", () => {
    it("computes ETA components from catalog snapshot", () => {
      const snapshot = buildSnapshot();
      const duration = estimateLearningDurations({
        snapshot,
        storeSize: classifyStoreSize(snapshot.productsCount),
      });
      expect(duration.bootstrapDurationMinutes).toBeGreaterThan(0);
      expect(duration.historicalImportMinutes).toBeGreaterThan(0);
      expect(duration.totalEstimatedMinutes).toBeGreaterThan(duration.bootstrapDurationMinutes);
    });

    it("formats merchant ETA copy", () => {
      expect(formatEtaMinutes(41)).toBe("41 minutes");
      expect(formatEtaMinutes(1)).toBe("1 minute");
    });
  });

  describe("learning prioritizer", () => {
    it("orders domains by business impact", () => {
      const priorities = buildLearningPriorities();
      expect(priorities[0]?.domain).toBe("revenue");
      expect(priorities.at(-1)?.domain).toBe("seasonality");
    });

    it("sorts arbitrary items by priority", () => {
      const sorted = sortByLearningPriority([
        { domain: "seasonality" },
        { domain: "inventory" },
        { domain: "revenue" },
      ]);
      expect(sorted.map((row) => row.domain)).toEqual([
        "revenue",
        "inventory",
        "seasonality",
      ]);
    });
  });

  describe("initial confidence and velocity", () => {
    it("never starts overall confidence at zero for stores with history", () => {
      const snapshot = buildSnapshot();
      const scores = estimateCatalogComplexity(snapshot);
      const confidences = computeInitialConfidences({ snapshot, scores });
      const overall = computeOverallConfidence(confidences);
      expect(overall).toBeGreaterThanOrEqual(45);
      expect(confidences.inventory).toBeGreaterThan(50);
      expect(confidences.seo).toBeGreaterThan(20);
    });

    it("assigns velocity tiers per domain", () => {
      const snapshot = buildSnapshot();
      const scores = estimateCatalogComplexity(snapshot);
      const confidences = computeInitialConfidences({ snapshot, scores });
      const velocities = assignLearningVelocities(confidences);
      const inventory = velocities.find((row) => row.domain === "inventory");
      const seasonality = velocities.find((row) => row.domain === "seasonality");
      expect(inventory?.velocity).toBe("fast");
      expect(seasonality?.velocity).toBe("slow");
    });

    it("resolves bootstrap stage to historical import", () => {
      expect(resolveBootstrapStage()).toBe("historical_import");
    });
  });

  describe("learning ETA", () => {
    it("builds merchant headline and completion timestamp", () => {
      const snapshot = buildSnapshot();
      const duration = estimateLearningDurations({
        snapshot,
        storeSize: "small",
      });
      const eta = buildLearningEta({
        duration,
        historyMonthsDisplay: snapshot.estimatedHistoryMonths,
        startedAt: new Date("2025-01-01T00:00:00.000Z"),
      });
      expect(eta.merchantHeadline).toContain("18 months");
      expect(eta.estimatedCompletionAt.getTime()).toBeGreaterThan(
        new Date("2025-01-01T00:00:00.000Z").getTime(),
      );
    });
  });
});
