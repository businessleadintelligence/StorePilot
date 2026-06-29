import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";

import { ExecutiveDashboard } from "../../components/executive/ExecutiveDashboard";
import type { ExecutiveDashboardData } from "../../services/executive-dashboard.server";

const dashboard: ExecutiveDashboardData = {
  summaryCards: {
    storeHealth: 91,
    revenueHealth: 82,
    inventoryHealth: 74,
    growthScore: 68,
    aiConfidence: 0.92,
    openRecommendations: 1,
    highPriorityTasks: 1,
  },
  briefing: {
    greeting: "Good morning.",
    storeHealth: 91,
    summaryLines: ["Store health is 91 / 100."],
    estimatedOpportunity: 82400,
    highestPriorities: ["Increase inventory for Protein Powder"],
  },
  groupedRecommendations: {
    "Critical Risks": [
      {
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
        estimatedImpact: { revenueRecovered: 42000 },
        merchantAction: ["Order 300 additional units"],
        tasks: ["Increase inventory"],
        timeline: { detected: "2026-06-20T08:00:00.000Z", created: "2026-06-20T08:00:00.000Z" },
        status: "open",
        verification: {},
        expectedResult: "Restore inventory coverage",
        potentialRisk: "Capital tied up if demand softens",
        estimatedTime: "1-2 weeks",
        businessImpact: "Protect revenue during sustained demand",
        lastSeenAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-20T08:00:00.000Z",
      },
    ],
    "Revenue Opportunities": [],
    "Quick Wins": [],
    "Operational Improvements": [],
    "Long-Term Strategy": [],
  },
  productSpotlight: null,
  analytics: {
    revenueTrend: [{ label: "Jun 01", value: 100 }],
    inventoryTrend: [],
    healthScoreHistory: [],
    recommendationImpact: [],
    topProducts: [],
    bottomProducts: [],
    velocityTrend: [],
    refundTrend: [],
    inventoryAge: [],
    healthDistribution: [],
    recommendationCompletionRate: 0,
  },
  timeline: [
    {
      id: "stable-1:detected",
      stableId: "stable-1",
      recommendationId: "inventory-replenishment-plan",
      title: "Increase inventory for Protein Powder",
      type: "detected",
      message: "AI detected an issue",
      at: "2026-06-20T08:00:00.000Z",
    },
  ],
  tasks: [
    {
      id: "stable-1:0",
      title: "Increase inventory",
      priority: 1,
      estimatedImpact: 42000,
      difficulty: "Easy",
      relatedRecommendationId: "inventory-replenishment-plan",
      relatedRecommendationTitle: "Increase inventory for Protein Powder",
      stableId: "stable-1",
      subjectKey: "product:product-1",
    },
  ],
  recommendations: [],
  storeHealthScore: {
    score: 91,
    grade: "A",
    productsScore: 20,
    inventoryScore: 20,
    ordersScore: 40,
    issues: [],
  },
  metrics: {
    products: 10,
    activeProducts: 10,
    orders: 100,
    grossRevenue: 1000,
    averageOrderValue: 10,
    lowStockProducts: 1,
    outOfStockProducts: 0,
    inventoryUnits: 100,
  },
  currency: "USD",
  lastUpdatedAt: "2026-06-20T08:00:00.000Z",
};

describe("Executive dashboard components", () => {
  it("renders recommendation, task, and briefing sections", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <ExecutiveDashboard dashboard={dashboard} onOpenRecommendation={() => undefined} />
          ),
        },
      ],
      { initialEntries: ["/"] },
    );

    const html = renderToString(<RouterProvider router={router} />);

    expect(html).toContain("Executive Dashboard");
    expect(html).toContain("Today&#x27;s AI Briefing");
    expect(html).toContain("Increase inventory for Protein Powder");
    expect(html).toContain("Merchant Tasks");
    expect(html).toContain("Recommendation Timeline");
  });
});
