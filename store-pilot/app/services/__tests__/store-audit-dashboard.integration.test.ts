import { describe, expect, it } from "vitest";
import { buildStoreAuditPanel } from "../../services/executive-dashboard.server";
import { buildStoreAuditWidget } from "../../services/command-center.server";

describe("Store audit dashboard aggregation", () => {
  it("builds executive store audit panel from persisted results", () => {
    const panel = buildStoreAuditPanel({
      storeAuditResults: [
        { resultJson: { storeHealthScore: 70, seoScore: 68, performanceScore: 72, accessibilityScore: 71 } },
        { resultJson: { storeHealthScore: 74, overallAuditScore: 74, seoScore: 76, performanceScore: 72, accessibilityScore: 71 } },
      ],
      auditRecommendations: [
        {
          id: "1",
          stableId: "stable-1",
          subjectKey: "store-audit:store-1",
          productId: null,
          productTitle: null,
          title: "Compress images",
          reason: "Images need optimization",
          category: "Images",
          group: "Quick Wins",
          priority: 1,
          priorityScore: 90,
          confidence: 0.9,
          difficulty: "Easy",
          evidence: [],
          estimatedImpact: {
            revenueRecovered: null,
            revenueOpportunity: 5000,
            ordersProtected: null,
            inventoryDaysSaved: null,
            inventoryCostSaved: null,
            estimatedLostSales: null,
            marginImprovement: null,
          },
          merchantAction: ["Compress images"],
          tasks: ["Compress images"],
          timeline: {},
          status: "open",
          verification: {},
          expectedResult: "Faster pages",
          potentialRisk: "None",
          estimatedTime: "1 week",
          businessImpact: "Performance",
          lastSeenAt: "2026-06-20T08:00:00.000Z",
          updatedAt: "2026-06-20T08:00:00.000Z",
        },
      ],
    });

    expect(panel.overallAuditScore).toBe(74);
    expect(panel.criticalIssues).toBe(1);
    expect(panel.auditHistory.length).toBe(2);
    expect(panel.trendChart.length).toBeGreaterThan(0);
  });

  it("builds command center store audit widget with category breakdown", async () => {
    const widget = await buildStoreAuditWidget("store-1", [
      {
        id: "1",
        stableId: "stable-1",
        subjectKey: "store-audit:store-1",
        productId: null,
        productTitle: null,
        title: "Improve navigation",
        reason: "Navigation depth is high",
        category: "Navigation",
        group: "Quick Wins",
        priority: 2,
        priorityScore: 80,
        confidence: 0.85,
        difficulty: "Easy",
        evidence: [],
        estimatedImpact: {
          revenueRecovered: null,
          revenueOpportunity: null,
          ordersProtected: null,
          inventoryDaysSaved: null,
          inventoryCostSaved: null,
          estimatedLostSales: null,
          marginImprovement: null,
        },
        merchantAction: ["Simplify menu"],
        tasks: ["Simplify menu"],
        timeline: {},
        status: "open",
        verification: {},
        expectedResult: "Better UX",
        potentialRisk: "None",
        estimatedTime: "1 week",
        businessImpact: "Navigation",
        lastSeenAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-20T08:00:00.000Z",
      },
    ]);

    expect(widget.overallAuditScore).toBeGreaterThanOrEqual(0);
    expect(widget.categoryBreakdown.some((item) => item.label === "Navigation")).toBe(true);
    expect(widget.quickWins.length).toBeGreaterThan(0);
    expect(widget.healthTrend.length).toBeGreaterThan(0);
  });
});
