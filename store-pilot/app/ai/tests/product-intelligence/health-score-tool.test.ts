import { describe, expect, it } from "vitest";

import { calculateProductHealthScore } from "../../tools/health-score-tool";

describe("Product health score tool", () => {
  it("returns a bounded score from deterministic inputs", () => {
    const score = calculateProductHealthScore({
      stockRisk: "LOW",
      trend: "growing",
      refundRate: 1,
      sales30Days: 40,
      margin: 35,
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("penalizes critical inventory risk and declining trend", () => {
    const healthy = calculateProductHealthScore({
      stockRisk: "LOW",
      trend: "growing",
      refundRate: 1,
      sales30Days: 40,
      margin: 35,
    });

    const stressed = calculateProductHealthScore({
      stockRisk: "CRITICAL",
      trend: "declining",
      refundRate: 12,
      sales30Days: 0,
      margin: 10,
    });

    expect(stressed).toBeLessThan(healthy);
  });
});
