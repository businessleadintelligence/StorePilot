import { describe, expect, it } from "vitest";

import {
  EXECUTIVE_RECOMMENDATION_GROUPS,
  mapRecommendationRecord,
} from "../../services/executive-dashboard.server";

describe("Executive dashboard aggregation", () => {
  it("maps persisted recommendation records into executive views", () => {
    const view = mapRecommendationRecord({
      stableId: "stable-1",
      subjectKey: "product:product-1",
      title: "Increase inventory for Protein Powder",
      summary: "Low stock detected",
      category: "Inventory",
      priority: 1,
      confidence: 0.96,
      status: "open",
      payloadJson: {
        id: "inventory-replenishment-plan",
        group: "Critical Risks",
        reason: "Sales velocity increased while inventory decreased to six days.",
        evidence: ["30 day sales +38%", "Inventory only 6 days"],
        merchantAction: ["Order 300 additional units"],
        tasks: ["Increase inventory"],
        priorityScore: 91,
        difficulty: "Easy",
        expectedResult: "Restore inventory coverage",
        potentialRisk: "Capital tied up if demand softens",
        estimatedTime: "1-2 weeks",
        businessImpact: "Protect revenue during sustained demand",
        estimatedImpact: {
          revenueRecovered: 42000,
          ordersProtected: 63,
        },
        timeline: {
          detected: "2026-06-20T08:00:00.000Z",
          created: "2026-06-20T08:00:00.000Z",
        },
      },
      lastSeenAt: new Date("2026-06-20T08:00:00.000Z"),
      updatedAt: new Date("2026-06-20T08:00:00.000Z"),
      productTitle: "Protein Powder",
    });

    expect(view.productId).toBe("product-1");
    expect(view.group).toBe("Critical Risks");
    expect(view.evidence).toHaveLength(2);
    expect(view.estimatedImpact.revenueRecovered).toBe(42000);
    expect(view.tasks).toEqual(["Increase inventory"]);
  });

  it("exposes all executive recommendation groups", () => {
    expect(EXECUTIVE_RECOMMENDATION_GROUPS).toEqual([
      "Critical Risks",
      "Revenue Opportunities",
      "Quick Wins",
      "Operational Improvements",
      "Long-Term Strategy",
    ]);
  });
});
