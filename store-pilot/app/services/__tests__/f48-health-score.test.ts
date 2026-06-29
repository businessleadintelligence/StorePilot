import { beforeEach, describe, expect, it } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  buildHealthIssues,
  calculateHealthGrade,
  calculateInventoryScore,
  calculateOrdersScore,
  calculateProductsScore,
  calculateStoreHealthScore,
  clampHealthScore,
  getStoreHealthScore,
  serializeHealthScoreForLoader,
} from "../health-score.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
});

describe("F.4.8 Store Health Score Engine", () => {
  it("1. scores an empty store at zero with grade F", async () => {
    const healthScore = await getStoreHealthScore(STORE_ID);

    expect(healthScore).toEqual({
      score: 30,
      grade: "F",
      productsScore: 0,
      inventoryScore: 30,
      ordersScore: 0,
      issues: ["No products synced", "No orders have been synced"],
    });
    expect(healthScore.score).toBeGreaterThanOrEqual(0);
    expect(healthScore.score).toBeLessThanOrEqual(100);
  });

  it("2. scores a healthy store at 100 with grade A", () => {
    const healthScore = calculateStoreHealthScore({
      products: 60,
      activeProducts: 60,
      orders: 120,
      grossRevenue: 10000,
      averageOrderValue: 83.33,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inventoryUnits: 500,
    });

    expect(healthScore).toEqual({
      score: 100,
      grade: "A",
      productsScore: 30,
      inventoryScore: 30,
      ordersScore: 40,
      issues: [],
    });
  });

  it("3. applies low-stock and out-of-stock inventory penalties", () => {
    expect(calculateInventoryScore(3, 2)).toBe(14);
    expect(calculateInventoryScore(0, 0)).toBe(30);

    const healthScore = calculateStoreHealthScore({
      products: 20,
      activeProducts: 20,
      orders: 25,
      grossRevenue: 1000,
      averageOrderValue: 40,
      lowStockProducts: 3,
      outOfStockProducts: 2,
      inventoryUnits: 40,
    });

    expect(healthScore.inventoryScore).toBe(14);
    expect(healthScore.score).toBe(54);
    expect(healthScore.grade).toBe("F");
  });

  it("4. scores orders tiers and handles no orders", () => {
    expect(calculateOrdersScore(0)).toBe(0);
    expect(calculateOrdersScore(5)).toBe(10);
    expect(calculateOrdersScore(25)).toBe(20);
    expect(calculateOrdersScore(75)).toBe(30);
    expect(calculateOrdersScore(101)).toBe(40);
  });

  it("5. calculates product tiers", () => {
    expect(calculateProductsScore(0)).toBe(0);
    expect(calculateProductsScore(5)).toBe(10);
    expect(calculateProductsScore(25)).toBe(20);
    expect(calculateProductsScore(51)).toBe(30);
  });

  it("6. assigns grades across score boundaries", () => {
    expect(calculateHealthGrade(100)).toBe("A");
    expect(calculateHealthGrade(90)).toBe("A");
    expect(calculateHealthGrade(89)).toBe("B");
    expect(calculateHealthGrade(80)).toBe("B");
    expect(calculateHealthGrade(79)).toBe("C");
    expect(calculateHealthGrade(70)).toBe("C");
    expect(calculateHealthGrade(69)).toBe("D");
    expect(calculateHealthGrade(60)).toBe("D");
    expect(calculateHealthGrade(59)).toBe("F");
  });

  it("7. generates merchant-safe factual issues only", () => {
    const issues = buildHealthIssues({
      products: 0,
      activeProducts: 0,
      orders: 0,
      grossRevenue: 0,
      averageOrderValue: 0,
      lowStockProducts: 3,
      outOfStockProducts: 2,
      inventoryUnits: 0,
    });

    expect(issues).toEqual([
      "No products synced",
      "3 products are low stock",
      "2 products are out of stock",
      "No orders have been synced",
    ]);
    expect(JSON.stringify(issues)).not.toContain("GraphQL");
    expect(JSON.stringify(issues)).not.toContain("worker");
  });

  it("8. clamps score and never returns negative component scores", () => {
    expect(clampHealthScore(120)).toBe(100);
    expect(clampHealthScore(-10)).toBe(0);
    expect(calculateInventoryScore(100, 100)).toBe(0);

    const serialized = serializeHealthScoreForLoader({
      score: 84,
      grade: "B",
      productsScore: 20,
      inventoryScore: 24,
      ordersScore: 40,
      issues: ["3 products are low stock"],
    });

    expect(serialized.score).toBe(84);
    expect(serialized.grade).toBe("B");
    expect(serialized.productsScore).toBe(20);
    expect(serialized.inventoryScore).toBe(24);
    expect(serialized.ordersScore).toBe(40);
  });

  it("9. integrates with database metrics for a seeded store", async () => {
    const harness = testHarness();

    for (let index = 0; index < 27; index += 1) {
      harness.seedProduct({
        shopifyVariantId: `gid://shopify/ProductVariant/${index + 1}`,
        shopifyProductId: `gid://shopify/Product/${index + 1}`,
        inventoryQuantity: 20,
        inventoryTracked: true,
      });
    }

    for (let index = 0; index < 3; index += 1) {
      harness.seedProduct({
        shopifyVariantId: `gid://shopify/ProductVariant/low-${index + 1}`,
        shopifyProductId: `gid://shopify/Product/low-${index + 1}`,
        inventoryQuantity: 3,
        inventoryTracked: true,
      });
    }

    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/out-1",
      shopifyProductId: "gid://shopify/Product/out-1",
      inventoryQuantity: 0,
      inventoryTracked: true,
    });

    for (let index = 0; index < 173; index += 1) {
      harness.seedOrder({
        shopifyOrderId: `gid://shopify/Order/${index + 1}`,
        totalPriceAmount: "71.96",
        isPaid: true,
      });
    }

    const healthScore = await getStoreHealthScore(STORE_ID);

    expect(healthScore.productsScore).toBe(20);
    expect(healthScore.ordersScore).toBe(40);
    expect(healthScore.inventoryScore).toBeLessThan(30);
    expect(healthScore.score).toBeGreaterThanOrEqual(0);
    expect(healthScore.score).toBeLessThanOrEqual(100);
    expect(healthScore.issues.some((issue) => issue.includes("low stock"))).toBe(
      true,
    );
  });
});
