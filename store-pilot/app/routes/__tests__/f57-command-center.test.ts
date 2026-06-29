import { beforeEach, describe, expect, it, vi } from "vitest";

import { action, loader } from "../app.command-center";
import { authenticate } from "../../shopify.server";
import { getCommandCenterData } from "../../services/command-center.server";

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

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
}));

vi.mock("../../services/command-center.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/command-center.server")>();
  return {
    ...actual,
    getCommandCenterData: vi.fn(),
  };
});

vi.mock("../../services/product-intelligence.server", () => ({
  recordMerchantRecommendationFeedback: vi.fn(),
}));

vi.mock("../../services/ai-results.server", () => ({
  updateRecommendationStatus: vi.fn(),
}));

const SHOP = "storepilot-test.myshopify.com";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Command center route", () => {
  it("returns null command center when store is missing", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "missing-shop.myshopify.com" },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue(null);

    const data = await loader({
      request: new Request("http://localhost/app/command-center"),
    } as Parameters<typeof loader>[0]);

    expect(data.commandCenter).toBeNull();
  });

  it("loads persisted command center data without invoking AI", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP, firstName: "John" },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({
      id: "store-1",
      currency: "USD",
      storeName: "Acme Store",
    } as never);

    vi.mocked(getCommandCenterData).mockResolvedValue({
      header: {
        merchantName: "John",
        greeting: "Good morning",
        storeHealth: 86,
        criticalIssues: 2,
        opportunities: 4,
        potentialRevenue: 43000,
      },
      briefing: { headline: "Your AI COO has analyzed your store.", paragraphs: ["Briefing line"] },
      activityFeed: [],
      agents: [],
      executive: {
        summaryCards: {
          storeHealth: 86,
          revenueHealth: 82,
          inventoryHealth: 74,
          growthScore: 68,
          aiConfidence: 0.9,
          openRecommendations: 3,
          highPriorityTasks: 1,
        },
        briefing: {
          greeting: "Good morning.",
          storeHealth: 86,
          summaryLines: [],
          estimatedOpportunity: 43000,
          highestPriorities: [],
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
          overallAuditScore: 0,
          auditHealth: 0,
          criticalIssues: 0,
          seoHealth: 0,
          performanceHealth: 0,
          accessibilityHealth: 0,
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
          score: 86,
          grade: "B",
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
        lastUpdatedAt: null,
      },
      healthRing: { score: 86, segments: [{ label: "Inventory", value: 74 }] },
      pipeline: { critical: [], high: [], medium: [], low: [] },
      charts: {
        revenueTrend: [],
        revenueVsRefunds: [],
        topProducts: [],
        bottomProducts: [],
        healthScoreHistory: [],
        recommendationCategories: [],
        inventoryAge: [],
        recommendationStatus: [],
        revenueOpportunityFunnel: [],
        storeHealthBreakdown: [],
      },
      aiTimeline: [],
      costWidget: {
        creditsUsed: 12,
        remainingCredits: 88,
        creditLimit: 100,
        estimatedValueGenerated: 43000,
      },
      inventoryIntelligence: {
        inventoryHealth: 0,
        openRecommendations: 0,
        stockoutAlerts: 0,
        deadStockAlerts: 0,
        recentExecutions: 0,
        capitalLocked: 0,
        averageWeeksOfCover: null,
        fastMovers: 0,
        slowMovers: 0,
        inventoryAlerts: [],
        recommendationGroups: [],
        opportunityPipeline: [],
        inventoryTrend: [],
      },
      bundleDiscovery: {
        bundleHealth: 0,
        openRecommendations: 0,
        topOpportunities: 0,
        potentialInventoryReduction: 0,
        potentialAttachRate: 0,
        recentExecutions: 0,
        recommendationGroups: [],
      },
      storeAudit: {
        overallAuditScore: 0,
        storeHealth: 0,
        homepageScore: 0,
        seoScore: 0,
        accessibilityScore: 0,
        performanceScore: 0,
        conversionScore: 0,
        mobileScore: 0,
        themeScore: 0,
        openRecommendations: 0,
        criticalIssues: 0,
        recentExecutions: 0,
        recommendationGroups: [],
        issueDistribution: [],
        topFixes: [],
        quickWins: [],
        criticalIssueFeed: [],
        healthTrend: [],
        categoryBreakdown: [],
        seoWidgets: [],
        accessibilityWidgets: [],
        performanceWidgets: [],
        auditTimeline: [],
        opportunityPipeline: [],
      },
      trendIntelligence: {
        trendHealth: 0,
        trendDirection: "unknown",
        openRecommendations: 0,
        emergingCount: 0,
        decliningCount: 0,
        recentExecutions: 0,
        growthAlerts: 0,
        declineAlerts: 0,
        recommendationGroups: [],
        momentumCharts: [],
        emergingOpportunities: [],
        categoryOpportunities: [],
        trendTimeline: [],
        opportunityPipeline: [],
      },
      seoIntelligence: {
        seoHealth: 0,
        organicOpportunity: 0,
        searchVisibility: 0,
        coreWebVitals: 0,
        technicalSeo: 0,
        contentQuality: 0,
        openRecommendations: 0,
        criticalIssues: 0,
        recentExecutions: 0,
        recommendationGroups: [],
        seoTimeline: [],
        organicGrowth: [],
        criticalSeoFeed: [],
        quickWins: [],
        trendHistory: [],
        issueDistribution: [],
        opportunityPipeline: [],
      },
      pricingIntelligence: {
        pricingHealth: 0,
        marginPercent: 0,
        profitOpportunity: 0,
        revenueOpportunity: 0,
        openRecommendations: 0,
        criticalPricingRisks: 0,
        recentExecutions: 0,
        recommendationGroups: [],
        pricingTimeline: [],
        marginTrend: [],
        criticalPricingFeed: [],
        opportunityPipeline: [],
      },
      growthIntelligence: {
        growthScore: 0,
        monthlyRevenueOpportunity: 0,
        aovOpportunity: 0,
        repeatPurchaseOpportunity: 0,
        expansionReadiness: 0,
        openRecommendations: 0,
        criticalGrowthRisks: 0,
        recentExecutions: 0,
        recommendationGroups: [],
        campaignTimeline: [],
        growthTrend: [],
        criticalGrowthFeed: [],
        opportunityPipeline: [],
      },
      executiveCoo: {
        todaysPriority: null,
        businessHealth: 0,
        executiveConfidence: 0,
        merchantCapacity: 0,
        businessMomentum: 0,
        criticalPathLength: 0,
        openPriorities: 0,
        blockedTasks: 0,
        recentExecutions: 0,
        focusAreaGroups: [],
        executionTimeline: [],
        criticalPriorityFeed: [],
        opportunityPipeline: [],
        businessHealthTrend: [],
        capacityUsage: [],
        blockedTasksChart: [],
      },
      executiveDecisions: {
        topDecision: null,
        consensusScore: 0,
        conflictCount: 0,
        dependencyCount: 0,
        topRisk: null,
        topOpportunity: null,
        decisions: [],
        charts: {
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
      },
      currency: "USD",
    });

    const data = await loader({
      request: new Request("http://localhost/app/command-center"),
    } as Parameters<typeof loader>[0]);

    expect(getCommandCenterData).toHaveBeenCalledWith({
      storeId: "store-1",
      currency: "USD",
      merchantName: "John",
    });
    expect(data.commandCenter?.header.merchantName).toBe("John");
  });

  it("records recommendation feedback through existing APIs", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-1" } as never);

    const { recordMerchantRecommendationFeedback } = await import(
      "../../services/product-intelligence.server"
    );

    const response = await action({
      request: new Request("http://localhost/app/command-center", {
        method: "POST",
        body: new URLSearchParams({
          intent: "implement",
          stableId: "stable-1",
          subjectKey: "product:product-1",
        }),
      }),
    } as Parameters<typeof action>[0]);

    expect(recordMerchantRecommendationFeedback).toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: true });
  });
});
