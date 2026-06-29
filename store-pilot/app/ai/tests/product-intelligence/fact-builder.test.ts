import { describe, expect, it } from "vitest";

import { createProductFactsBuilder } from "../../facts/product-facts";
import { calculateProductHealthScore } from "../../tools/health-score-tool";
import { createMockProductSnapshot } from "./helpers";

describe("Product Intelligence fact builder integration", () => {
  it("builds product facts with application-owned health score", async () => {
    const snapshot = createMockProductSnapshot();
    const builder = createProductFactsBuilder({
      async getProductSnapshot() {
        return snapshot;
      },
    });

    const facts = await builder.build({
      storeId: "store-1",
      productId: snapshot.productId,
    });

    expect(facts.storeId).toBe("store-1");
    expect(facts.healthScore).toBe(
      calculateProductHealthScore({
        stockRisk: facts.stockRisk,
        trend: facts.trend,
        refundRate: facts.refundRate,
        sales30Days: facts.sales30Days,
        margin: facts.margin,
      }),
    );
    expect(facts.velocity).toBeGreaterThan(0);
    expect(builder.fingerprint(facts)).toHaveLength(64);
  });
});
