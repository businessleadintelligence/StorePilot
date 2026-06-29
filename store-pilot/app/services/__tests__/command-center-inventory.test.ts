import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildInventoryIntelligenceWidget } from "../command-center.server";

vi.mock("../../db.server", () => ({
  default: {
    aiAgentResult: {
      findFirst: vi.fn(),
    },
    aiAgentRun: {
      count: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Command center inventory aggregation", () => {
  it("builds inventory intelligence widget fields from recommendations", async () => {
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.aiAgentResult.findFirst).mockResolvedValue({
      resultJson: {
        inventoryHealthScore: 78,
        stockoutAlertCount: 2,
        deadStockCount: 1,
        overstockCount: 0,
        understockCount: 1,
        capitalLockedInInventory: 348,
        averageWeeksOfCover: 1.7,
        fastMoverCount: 1,
        slowMoverCount: 0,
      },
    } as never);
    vi.mocked(prisma.aiAgentRun.count).mockResolvedValue(3);

    const widget = await buildInventoryIntelligenceWidget("store-1", [
      {
        stableId: "stable-1",
        id: "reorder:product-1",
        subjectKey: "inventory:store-1",
        productId: null,
        productTitle: null,
        title: "Reorder Blue Hoodie before projected stockout",
        reason: "Coverage is low",
        category: "Reorder",
        group: "Operational Improvements",
        priority: 1,
        priorityScore: 90,
        confidence: 0.9,
        difficulty: "Easy",
        evidence: [],
        estimatedImpact: {
          revenueRecovered: null,
          revenueOpportunity: null,
          ordersProtected: 10,
          inventoryDaysSaved: 5,
          inventoryCostSaved: null,
          estimatedLostSales: null,
          marginImprovement: null,
        },
        merchantAction: ["Reorder 20 units"],
        tasks: ["Reorder 20 units"],
        timeline: {},
        status: "open",
        verification: {},
        expectedResult: "Restore coverage",
        potentialRisk: "Demand softens",
        estimatedTime: "1 week",
        businessImpact: "Protect fulfillment",
        lastSeenAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-20T08:00:00.000Z",
      },
    ]);

    expect(widget.inventoryHealth).toBe(78);
    expect(widget.openRecommendations).toBe(1);
    expect(widget.stockoutAlerts).toBe(2);
    expect(widget.deadStockAlerts).toBe(1);
    expect(widget.recentExecutions).toBe(3);
    expect(widget.capitalLocked).toBe(348);
    expect(widget.averageWeeksOfCover).toBe(1.7);
    expect(widget.inventoryAlerts).toEqual([
      { label: "Stockout", value: 2 },
      { label: "Dead Stock", value: 1 },
      { label: "Overstock", value: 0 },
      { label: "Understock", value: 1 },
    ]);
    expect(widget.recommendationGroups).toEqual([
      { label: "Operational Improvements", value: 1 },
    ]);
    expect(widget.opportunityPipeline[0]?.value).toBe(1);
  });
});
