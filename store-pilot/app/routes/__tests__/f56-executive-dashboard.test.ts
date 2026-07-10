import { beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../app.coo";
import { authenticate } from "../../shopify.server";
import { getExecutiveDashboard, mapRecommendationRecord } from "../../services/executive-dashboard.server";

vi.mock("../../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
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
        inventoryHealthHistory: [],
        deadStockCount: [],
        stockCoverageTrend: [],
        reorderTimeline: [],
        inventoryRiskDistribution: [],
        topBundleOpportunities: [],
        bundleSuccessRate: [],
        potentialInventoryReduction: [],
        potentialAttachRate: [],
        bundleHealth: [],
        abcDistribution: [],
        weeksOfCover: [],
        capitalLocked: [],
        inventoryTimeline: [],
        storeAuditHealth: [],
        homepageScore: [],
        seoScoreHistory: [],
        accessibilityScoreHistory: [],
        performanceScoreHistory: [],
        themeScoreHistory: [],
        conversionScoreHistory: [],
        mobileScoreHistory: [],
        storeAuditIssueDistribution: [],
        storeAuditRecommendationTrend: [],
        trendHealth: [],
        emergingProductsTrend: [],
        decliningProductsTrend: [],
        momentumTrend: [],
        growthVsDeclineTrend: [],
        trendRevenueTrend: [],
        trendVelocityTrend: [],
        seasonalityTrend: [],
        categoryTrendChart: [],
        trendTimeline: [],
        seoIntelligenceHealthHistory: [],
        seoVisibilityTrend: [],
        seoCtrTrend: [],
        seoOrganicOpportunity: [],
        seoCoreWebVitalsTrend: [],
        seoTechnicalRadar: [],
        seoIssueDistribution: [],
        seoKeywordDistribution: [],
        seoPositionTrend: [],
        seoIndexCoverage: [],
        seoContentQuality: [],
        seoHealthTimeline: [],
        pricingHealthHistory: [],
        marginTrend: [],
        revenueVsProfit: [],
        discountTrend: [],
        priceDistribution: [],
        pricingRisk: [],
        pricingOpportunityFunnel: [],
        marginDistribution: [],
        discountDependenceTrend: [],
        pricingTimeline: [],
      },
      storeAuditPanel: {
        overallAuditScore: 74,
        auditHealth: 74,
        criticalIssues: 0,
        seoHealth: 76,
        performanceHealth: 72,
        accessibilityHealth: 71,
        auditHistory: [],
        auditTimeline: [],
        trendChart: [],
      },
      seoIntelligencePanel: {
        seoHealth: 0,
        seoTrend: [],
        organicOpportunity: 0,
        searchVisibility: 0,
        coreWebVitals: 0,
        technicalSeo: 0,
        contentQuality: 0,
        indexCoverage: 0,
        structuredData: 0,
        quickWins: [],
        opportunityTimeline: [],
        seoHistory: [],
      },
      pricingIntelligencePanel: {
        pricingHealth: 0,
        marginPercent: 0,
        profitOpportunity: 0,
        revenueOpportunity: 0,
        averageDiscountPercent: 0,
        discountDependence: 0,
        pricingHealthTrend: [],
        marginTrend: [],
        revenueVsProfit: [],
        discountTrend: [],
        priceDistribution: [],
        pricingRisk: [],
        opportunityFunnel: [],
        marginDistribution: [],
        discountDependenceTrend: [],
        pricingTimeline: [],
        criticalPricingRisks: [],
      },
      growthIntelligencePanel: {
        growthScore: 0,
        monthlyRevenueOpportunity: 0,
        aovOpportunity: 0,
        repeatPurchaseOpportunity: 0,
        expansionReadiness: 0,
        growthTrend: [],
        opportunityFunnel: [],
        growthCategories: [],
        revenueLiftForecast: [],
        growthRoi: [],
        campaignTimeline: [],
        collectionPerformance: [],
        growthCapacity: [],
        revenueSources: [],
        priorityDistribution: [],
        criticalGrowthRisks: [],
      },
      executiveCooPanel: {
        todaysPriority: null,
        businessHealth: 0,
        executiveConfidence: 0,
        merchantCapacity: 0,
        businessMomentum: 0,
        criticalPathLength: 0,
        executionTimeline: [],
        priorityDistribution: [],
        businessHealthTrend: [],
        capacityUsage: [],
        opportunityCostChart: [],
        dependencyGraph: [],
        executionFunnel: [],
        businessMomentumChart: [],
        criticalPathChart: [],
        blockedTasksChart: [],
      },
      executiveDecisions: [],
      collaborationSummary: null,
      collaborationCharts: {
        consensusGauge: [],
        agentInfluenceRadar: [],
        dependencyGraph: [],
        priorityMatrixImpact: [],
        priorityMatrixEffort: [],
        conflictHeatmap: [],
        recommendationSankey: [],
        decisionTimeline: [],
        roiWaterfall: [],
        healthWheel: [],
        confidenceDistribution: [],
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

describe("Executive dashboard presentation helpers", () => {
  it("derives merchant tasks from recommendation payloads", () => {
    const recommendation = mapRecommendationRecord({
      stableId: "stable-1",
      subjectKey: "product:product-1",
      title: "Create bundle with Shaker Bottle",
      summary: "Pair products to lift AOV",
      category: "Merchandising",
      priority: 2,
      confidence: 0.9,
      status: "open",
      payloadJson: {
        id: "bundle-best-seller",
        group: "Quick Wins",
        merchantAction: ["Create bundle"],
        tasks: ["Create bundle", "Review bundle pricing"],
      },
      lastSeenAt: new Date("2026-06-20T08:00:00.000Z"),
      updatedAt: new Date("2026-06-20T08:00:00.000Z"),
    });

    expect(recommendation.tasks).toEqual(["Create bundle", "Review bundle pricing"]);
    expect(recommendation.merchantAction).toEqual(["Create bundle"]);
  });
});
