import { describe, expect, it } from "vitest";

import {
  buildCommandCenterBriefing,
  buildHealthRing,
  buildOpportunityPipeline,
  formatDurationMs,
  formatRelativeTime,
  resolveMerchantDisplayName,
} from "../command-center.server";
import type { ExecutiveRecommendationView } from "../executive-dashboard.server";

const recommendation = {
  stableId: "stable-inv-1",
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
} satisfies ExecutiveRecommendationView;

describe("Executive dashboard inventory analytics types", () => {
  it("supports inventory recommendation views in command center helpers", () => {
    const pipeline = buildOpportunityPipeline([recommendation]);
    expect(pipeline.critical).toHaveLength(1);
    expect(formatDurationMs(4300)).toBe("4.3 sec");
    expect(formatRelativeTime("2026-06-20T10:00:00.000Z", Date.parse("2026-06-20T10:10:00.000Z"))).toBe(
      "10 min ago",
    );
    expect(resolveMerchantDisplayName({ firstName: "Asha" })).toBe("Asha");
  });

  it("builds health ring segments for inventory-aware command center data", () => {
    const ring = buildHealthRing({
      storeHealth: 78,
      inventoryHealth: 72,
      revenueHealth: 80,
      growthScore: 65,
      recommendations: [recommendation],
    });

    expect(ring.segments).toHaveLength(5);
    expect(ring.score).toBe(78);
  });

  it("builds command center briefing without invoking AI", () => {
    const briefing = buildCommandCenterBriefing({
      analyzedProducts: 12,
      recommendations: [recommendation],
      resultSummaries: ["Inventory coverage is tightening on two SKUs."],
      currency: "USD",
    });

    expect(briefing.paragraphs.length).toBeGreaterThan(0);
    expect(briefing.headline).toContain("AI COO");
  });
});
