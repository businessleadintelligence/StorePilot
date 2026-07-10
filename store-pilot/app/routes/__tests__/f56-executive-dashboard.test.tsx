import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

import { ExecutiveChart } from "../../components/executive/ExecutiveChart";
import { loader } from "../app.coo";
import { authenticate } from "../../shopify.server";
import { getExecutiveDashboard } from "../../services/executive-dashboard.server";

vi.mock("../../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../services/executive-dashboard.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/executive-dashboard.server")>();
  return {
    ...actual,
    getExecutiveDashboard: vi.fn(),
  };
});

const SHOP = "storepilot-test.myshopify.com";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Executive dashboard route loader", () => {
  it("returns null dashboard when store is missing", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "missing-shop.myshopify.com" },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue(null);

    const data = await loader({
      request: new Request("http://localhost/app/executive"),
    } as Parameters<typeof loader>[0]);

    expect(data.dashboard).toBeNull();
  });

  it("loads persisted executive dashboard data without invoking AI", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({
      id: "store-1",
      currency: "USD",
    } as never);

    vi.mocked(getExecutiveDashboard).mockResolvedValue({
      summaryCards: {
        storeHealth: 91,
        revenueHealth: 82,
        inventoryHealth: 74,
        growthScore: 68,
        aiConfidence: 0.92,
        openRecommendations: 3,
        highPriorityTasks: 2,
      },
      briefing: {
        greeting: "Good morning.",
        storeHealth: 91,
        summaryLines: ["Store health is 91 / 100."],
        estimatedOpportunity: 82400,
        highestPriorities: ["Increase inventory for Protein Powder"],
      },
      groupedRecommendations: {
        "Critical Risks": [],
        "Revenue Opportunities": [],
        "Quick Wins": [],
        "Operational Improvements": [],
        "Long-Term Strategy": [],
      },
      productSpotlight: null,
      analytics: {
        revenueTrend: [],
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
      timeline: [],
      tasks: [],
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
    });

    const data = await loader({
      request: new Request("http://localhost/app/executive"),
    } as Parameters<typeof loader>[0]);

    expect(getExecutiveDashboard).toHaveBeenCalledWith("store-1", "USD");
    expect(data.dashboard?.summaryCards.storeHealth).toBe(91);
    expect(data.dashboard?.briefing.highestPriorities[0]).toContain("Protein Powder");
  });
});

describe("Executive dashboard components", () => {
  it("renders chart loading state and interactive summary", () => {
    const html = renderToString(
      <ExecutiveChart
        title="Revenue trend"
        points={[
          { label: "Jun 01", value: 100 },
          { label: "Jun 02", value: 140 },
        ]}
        ariaLabel="Revenue trend chart"
      />,
    );

    expect(html).toContain("Revenue trend chart");
    expect(html).toContain("Revenue trend");
    expect(html).toContain("2 data points");
  });
});
