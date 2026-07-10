import { describe, expect, it } from "vitest";

import {
  buildAiTimeline,
  buildCommandCenterBriefing,
  buildHealthRing,
  buildOpportunityPipeline,
  formatDurationMs,
  formatRelativeTime,
  resolveMerchantDisplayName,
} from "../../services/command-center.server";
import type { ExecutiveRecommendationView } from "../../services/executive-dashboard.server";

const recommendation = {
  stableId: "stable-1",
  id: "inventory-replenishment-plan",
  subjectKey: "product:product-1",
  productId: "product-1",
  productTitle: "Protein Powder",
  title: "Increase inventory for Protein Powder",
  reason: "Sales velocity increased while inventory decreased to six days.",
  category: "Inventory",
  group: "Critical Risks",
  priority: 1,
  priorityScore: 91,
  confidence: 0.96,
  difficulty: "Easy",
  evidence: ["30 day sales +38%"],
  estimatedImpact: {
    revenueRecovered: 42000,
    revenueOpportunity: null,
    ordersProtected: null,
    inventoryDaysSaved: null,
    inventoryCostSaved: null,
    estimatedLostSales: null,
    marginImprovement: null,
  },
  merchantAction: ["Order 300 additional units"],
  tasks: ["Increase inventory"],
  timeline: {
    detected: "2026-06-20T08:00:00.000Z",
    created: "2026-06-20T08:12:00.000Z",
    implemented: "2026-06-20T09:15:00.000Z",
    verifying: "2026-06-20T09:40:00.000Z",
    verified: "2026-06-20T10:10:00.000Z",
  },
  status: "open",
  verification: {},
  expectedResult: "Restore inventory coverage",
  potentialRisk: "Capital tied up if demand softens",
  estimatedTime: "1-2 weeks",
  businessImpact: "Protect revenue during sustained demand",
  lastSeenAt: "2026-06-20T08:00:00.000Z",
  updatedAt: "2026-06-20T08:00:00.000Z",
} satisfies ExecutiveRecommendationView;

describe("Command center aggregation helpers", () => {
  it("resolves merchant display names from shop data without session PII", () => {
    expect(
      resolveMerchantDisplayName({
        firstName: "John",
        lastName: "Merchant",
        shopName: "Acme Store",
      }),
    ).toBe("Acme Store");
    expect(resolveMerchantDisplayName({ shopName: "Acme Store" })).toBe("Acme Store");
    expect(resolveMerchantDisplayName({ shop: "acme.myshopify.com" })).toBe("acme");
    expect(resolveMerchantDisplayName({})).toBe("there");
  });

  it("formats relative time and durations for activity cards", () => {
    expect(formatRelativeTime("2026-06-20T10:00:00.000Z", Date.parse("2026-06-20T10:06:00.000Z"))).toBe(
      "6 min ago",
    );
    expect(formatDurationMs(4200)).toBe("4.2 sec");
  });

  it("builds health ring segments from executive metrics", () => {
    const ring = buildHealthRing({
      storeHealth: 86,
      inventoryHealth: 74,
      revenueHealth: 82,
      growthScore: 68,
      recommendations: [recommendation],
    });

    expect(ring.score).toBe(86);
    expect(ring.segments).toHaveLength(5);
    expect(ring.segments[0]?.label).toBe("Inventory");
  });

  it("groups open recommendations into the opportunity pipeline", () => {
    const pipeline = buildOpportunityPipeline([
      recommendation,
      { ...recommendation, stableId: "stable-2", priority: 2, status: "viewed" },
      { ...recommendation, stableId: "stable-3", priority: 4, status: "dismissed" },
    ]);

    expect(pipeline.critical).toHaveLength(1);
    expect(pipeline.high).toHaveLength(1);
    expect(pipeline.low).toHaveLength(0);
  });

  it("builds briefing paragraphs from persisted summaries only", () => {
    const briefing = buildCommandCenterBriefing({
      analyzedProducts: 184,
      recommendations: [recommendation],
      resultSummaries: [
        "Two products are losing momentum while one is becoming a breakout performer.",
      ],
      currency: "USD",
    });

    expect(briefing.paragraphs[0]).toContain("184 products");
    expect(briefing.paragraphs.some((line) => line.includes("top three recommendations"))).toBe(true);
  });

  it("orders AI timeline events newest first", () => {
    const timeline = buildAiTimeline({
      runs: [
        {
          id: "run-1",
          createdAt: new Date("2026-06-20T09:12:00.000Z"),
          completedAt: new Date("2026-06-20T09:12:00.000Z"),
          status: "succeeded",
        },
      ],
      recommendations: [recommendation],
    });

    expect(timeline[0]?.at >= timeline[timeline.length - 1]?.at).toBe(true);
    expect(timeline.some((event) => event.title === "Verified")).toBe(true);
  });
});
