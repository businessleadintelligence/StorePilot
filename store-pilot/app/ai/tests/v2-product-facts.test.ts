import { describe, expect, it } from "vitest";

import { createMockUnifiedStoreMetricsForFacts } from "../migration/unified-metrics-migration";
import { createProductFactsBuilder } from "../facts/product-facts";
import {
  calculateSalesWindowMetrics,
  calculateTrend,
  calculateVelocity,
  buildInventoryMetrics,
} from "../tools";

describe("Product facts builder infrastructure", () => {
  it("builds typed product facts from deterministic tools", async () => {
    const builder = createProductFactsBuilder({
      async getProductSnapshot() {
        return {
          productId: "product-1",
          shopifyProductId: "gid://shopify/Product/1",
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          title: "Blue Hoodie",
          vendor: "StorePilot",
          category: null,
          status: "active",
          inventory: 120,
          reservedInventory: 20,
          margin: 27,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-15T00:00:00.000Z",
          salesByDay: [
            { day: "2026-06-20", quantity: 10, revenue: 500, orderCount: 8 },
            { day: "2026-06-19", quantity: 7, revenue: 350, orderCount: 6 },
          ],
          refundCount30Days: 1,
          unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
        };
      },
    });

    const facts = await builder.build({
      storeId: "store-1",
      productId: "product-1",
    });

    expect(facts.velocity).toBe(calculateVelocity(facts.sales30Days));
    expect(facts.trend).toBe(
      calculateTrend(facts.sales7Days, facts.sales30Days),
    );
    expect(facts.stockRisk).toBe(
      buildInventoryMetrics({
        inventory: 120,
        reservedInventory: 20,
        daysRemaining: facts.daysRemaining,
        velocity: facts.velocity,
      }).stockRisk,
    );
    expect(facts.margin).toBe(27);
    expect(builder.fingerprint(facts)).toHaveLength(64);
  });
});

describe("Deterministic tools", () => {
  it("calculates sales windows", () => {
    const metrics = calculateSalesWindowMetrics({
      now: new Date("2026-06-21T00:00:00.000Z"),
      quantitiesByDay: [
        { day: "2026-06-20", quantity: 10, revenue: 500, orderCount: 8 },
        { day: "2026-06-10", quantity: 3, revenue: 150, orderCount: 2 },
      ],
    });

    expect(metrics.sales7Days).toBe(10);
    expect(metrics.revenue30Days).toBe(650);
  });
});
