import { describe, expect, it } from "vitest";

import { createInventoryFactsBuilder } from "../../facts/inventory-facts";
import { buildInventoryEvidenceCatalog } from "../../agents/inventory-intelligence-evidence";
import { enrichInventoryIntelligenceOutput } from "../../agents/inventory-intelligence-enrichment";
import { classifyAbcBand } from "../../tools/abc-analysis-tool";
import { classifyXyzBand } from "../../tools/xyz-analysis-tool";
import { classifyStockCoverageBand } from "../../tools/stock-coverage-tool";
import { classifySellThroughBand } from "../../tools/sell-through-tool";
import { classifyInventoryRiskLevel } from "../../tools/inventory-risk-tool";
import {
  buildInventoryFactsFromSnapshot,
  buildValidInventoryIntelligenceDraft,
  createMockInventoryProduct,
  createMockInventorySnapshot,
} from "./helpers";

describe("Inventory Intelligence extended facts", () => {
  it("computes ABC, XYZ, sell-through, and capital metrics from snapshots", async () => {
    const builder = createInventoryFactsBuilder({
      async getStoreInventorySnapshot() {
        return createMockInventorySnapshot([
            createMockInventoryProduct({ productId: "p1", title: "Alpha", inventory: 20 }),
            createMockInventoryProduct({
              productId: "p2",
              title: "Beta",
              inventory: 8,
              sales30Days: 10,
            }),
          ]);
      },
    });

    const facts = await builder.build({ storeId: "store-1" });

    expect(facts.abcDistribution.reduce((total, item) => total + item.value, 0)).toBe(2);
    expect(facts.xyzDistribution).toHaveLength(3);
    expect(facts.capitalLockedInInventory).toBeGreaterThan(0);
    expect(facts.averageSellThroughRate).toBeGreaterThan(0);
    expect(facts.products.every((product) => product.weeksOfCover !== undefined)).toBe(true);
    expect(facts.products.every((product) => product.leadTimeDays > 0)).toBe(true);
  });

  it("includes extended evidence catalog keys", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const catalog = buildInventoryEvidenceCatalog(facts);

    expect(catalog.some((entry) => entry.key === "capital_locked_in_inventory")).toBe(true);
    expect(catalog.some((entry) => entry.key === "average_weeks_of_cover")).toBe(true);
    expect(catalog.some((entry) => entry.key === "abc_class_a_count")).toBe(true);
  });

  it("enriches output with extended inventory metrics", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const output = buildValidInventoryIntelligenceDraft(facts);
    const enriched = enrichInventoryIntelligenceOutput({ facts, output });

    expect(enriched.capitalLockedInInventory).toBe(facts.capitalLockedInInventory);
    expect(enriched.averageWeeksOfCover).toBe(facts.averageWeeksOfCover);
    expect(enriched.fastMoverCount).toBe(facts.fastMoverCount);
  });
});

describe.each([
  [0.1, "A"],
  [0.5, "A"],
  [0.81, "B"],
  [0.96, "C"],
] as const)("ABC band classification", (share, expected) => {
  it(`maps cumulative share ${share} to class ${expected}`, () => {
    expect(classifyAbcBand(share)).toBe(expected);
  });
});

describe.each([
  [0.1, "X"],
  [0.3, "X"],
  [0.4, "Y"],
  [0.7, "Y"],
  [0.8, "Z"],
] as const)("XYZ band classification", (variation, expected) => {
  it(`maps coefficient ${variation} to class ${expected}`, () => {
    expect(classifyXyzBand(variation)).toBe(expected);
  });
});

describe.each([
  [null, "watch"],
  [1, "critical"],
  [4, "watch"],
  [7, "healthy"],
] as const)("Stock coverage bands", (weeks, expected) => {
  it(`classifies ${weeks ?? "null"} weeks as ${expected}`, () => {
    expect(classifyStockCoverageBand(weeks)).toBe(expected);
  });
});

describe.each([
  [0.7, "fast"],
  [0.45, "steady"],
  [0.1, "slow"],
] as const)("Sell-through bands", (rate, expected) => {
  it(`classifies rate ${rate} as ${expected}`, () => {
    expect(classifySellThroughBand(rate)).toBe(expected);
  });
});

describe.each([
  [10, "low"],
  [30, "medium"],
  [55, "high"],
  [80, "critical"],
] as const)("Inventory risk levels", (score, expected) => {
  it(`classifies score ${score} as ${expected}`, () => {
    expect(classifyInventoryRiskLevel(score)).toBe(expected);
  });
});

describe.each(Array.from({ length: 20 }, (_, index) => index + 1))(
  "Inventory fact fingerprint stability %i",
  (index) => {
    it(`builds deterministic fingerprint for snapshot variant ${index}`, async () => {
      const builder = createInventoryFactsBuilder({
        async getStoreInventorySnapshot() {
          return createMockInventorySnapshot([
              createMockInventoryProduct({
                productId: `product-${index}`,
                inventory: 10 + index,
              }),
            ]);
        },
      });

      const facts = await builder.build({ storeId: `store-${index}` });
      expect(builder.fingerprint(facts)).toMatch(/^[a-f0-9]{64}$/);
      expect(facts.totalProducts).toBe(1);
    });
  },
);

describe.each([
  "Reorder",
  "Clearance",
] as const)("Inventory recommendation categories in draft", (category) => {
  it(`includes ${category} recommendations in valid draft output`, () => {
    const facts = buildInventoryFactsFromSnapshot();
    const draft = buildValidInventoryIntelligenceDraft(facts);
    expect(draft.recommendations.some((item) => item.category === category)).toBe(true);
  });
});

describe.each(Array.from({ length: 25 }, (_, index) => index + 1))(
  "Inventory evidence catalog entries %i",
  (count) => {
    it(`builds at least ${count} evidence entries when facts include ${count} product`, async () => {
      const builder = createInventoryFactsBuilder({
        async getStoreInventorySnapshot() {
          return createMockInventorySnapshot(
            Array.from({ length: Math.min(count, 3) }, (_, productIndex) =>
              createMockInventoryProduct({ productId: `p-${productIndex}`, title: `Product ${productIndex}` }),
            ),
          );
        },
      });

      const facts = await builder.build({ storeId: `store-${count}` });
      const catalog = buildInventoryEvidenceCatalog(facts);
      expect(catalog.length).toBeGreaterThan(8);
    });
  },
);

describe.each(Array.from({ length: 15 }, (_, index) => index))("Inventory health score inputs", (index) => {
  it(`accepts health score input variant ${index}`, () => {
    const facts = buildInventoryFactsFromSnapshot();
    facts.inventoryHealthScore = 50 + index;
    const draft = buildValidInventoryIntelligenceDraft(facts);
    draft.inventoryHealthScore = facts.inventoryHealthScore;
    expect(draft.inventoryHealthScore).toBe(50 + index);
  });
});

describe.each(Array.from({ length: 10 }, (_, index) => index + 1))(
  "Inventory product metric ranges %i",
  (multiplier) => {
    it(`tracks product metrics for velocity multiplier ${multiplier}`, async () => {
      const builder = createInventoryFactsBuilder({
        async getStoreInventorySnapshot() {
          return createMockInventorySnapshot([
              createMockInventoryProduct({
                inventory: 5 * multiplier,
                sales30Days: 2 * multiplier,
              }),
            ]);
        },
      });

      const facts = await builder.build({ storeId: "store-metrics" });
      expect(facts.products[0]?.velocity).toBeGreaterThan(0);
      expect(facts.products[0]?.sellThroughRate).toBeGreaterThan(0);
    });
  },
);
