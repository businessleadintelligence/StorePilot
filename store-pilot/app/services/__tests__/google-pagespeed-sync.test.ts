import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapConnectorPlatform,
  clearConnectorCache,
  resetConnectorPlatformBootstrap,
  resetConnectorRegistry,
  syncStoreConnectors,
} from "../../connectors";
import {
  configureGa4ConnectorDeps,
  resetGa4ConnectorDeps,
  type Ga4RawReport,
} from "../../connectors/google/ga4.connector";
import {
  configureGscConnectorDeps,
  resetGscConnectorDeps,
  type GscRawReport,
} from "../../connectors/google/search-console.connector";
import {
  configurePageSpeedConnectorDeps,
  resetPageSpeedConnectorDeps,
  type PageSpeedRawReport,
} from "../../connectors/google/pagespeed.connector";
import {
  configureClarityConnectorDeps,
  resetClarityConnectorDeps,
  type ClarityRawReport,
} from "../../connectors/microsoft/clarity.connector";

const STORE_ID = "store-pagespeed-sync-test";

const mockClarityReport: ClarityRawReport = {
  projectId: "clarity-project-1",
  numOfDays: 3,
  summary: {
    sessions: 1200,
    engagedSessions: 900,
    averageEngagementSeconds: 45,
    scrollDepth: 0.62,
    deadClicks: 24,
    rageClicks: 18,
    quickBacks: 11,
    scriptErrors: 4,
  },
  deviceBreakdown: { Mobile: 800 },
  browserBreakdown: { Chrome: 900 },
  countryBreakdown: { "United States": 700 },
  pageAggregates: [{ path: "/", sessions: 500, scrollDepth: 0.7, rageClicks: 2, deadClicks: 3, quickBacks: 1, scriptErrors: 0 }],
  heatmapAvailable: true,
  recordingAvailable: true,
};

const mockGa4Report: Ga4RawReport = {
  propertyId: "123456789",
  dateRanges: {
    last_7_days: { startDate: "2026-06-13", endDate: "2026-06-20" },
    last_30_days: { startDate: "2026-05-21", endDate: "2026-06-20" },
    previous_period: { startDate: "2026-04-21", endDate: "2026-05-20" },
  },
  metrics: {
    sessions: 800,
    totalUsers: 650,
    bounceRate: 0.4,
    purchaseRevenue: 9000,
    conversions: 30,
    transactions: 25,
    averageSessionDuration: 110,
  },
  channelBreakdown: { Direct: 200 },
  landingPages: ["/"],
  deviceCategories: { desktop: 400 },
  countries: { Canada: 100 },
};

const mockGscReport: GscRawReport = {
  siteUrl: "https://store.example.com/",
  dateRanges: {
    last_7_days: { startDate: "2026-06-13", endDate: "2026-06-20" },
    last_30_days: { startDate: "2026-05-21", endDate: "2026-06-20" },
    previous_period: { startDate: "2026-04-21", endDate: "2026-05-20" },
  },
  summary: { clicks: 500, impressions: 9000, ctr: 0.0556, position: 10.5 },
  summaryLast7Days: { clicks: 120, impressions: 2200, ctr: 0.0545, position: 10.1 },
  summaryPreviousPeriod: { clicks: 450, impressions: 8500, ctr: 0.0529, position: 11.2 },
  queries: [],
  topPages: [],
  countries: [],
  devices: [],
  searchTypes: [],
  coverage: { permissionLevel: "siteOwner", siteVerified: true },
};

const mockPageSpeedReport: PageSpeedRawReport = {
  pageUrl: "https://store.example.com/",
  desktop: {
    strategy: "desktop",
    pageUrl: "https://store.example.com/",
    categoryScores: { performance: 0.86, accessibility: 0.9, bestPractices: 0.88, seo: 0.92 },
    labMetrics: {
      lcpMs: 2100,
      fcpMs: 1200,
      cls: 0.05,
      inpMs: 150,
      speedIndexMs: 2800,
      ttfbMs: 400,
      tbtMs: 140,
    },
    coreWebVitals: {
      lcpMs: 2100,
      cls: 0.05,
      inpMs: 150,
      passesAssessment: true,
      lcpPass: true,
      clsPass: true,
      inpPass: true,
    },
    diagnostics: [],
    opportunities: [],
  },
  mobile: {
    strategy: "mobile",
    pageUrl: "https://store.example.com/",
    categoryScores: { performance: 0.78, accessibility: 0.88, bestPractices: 0.86, seo: 0.9 },
    labMetrics: {
      lcpMs: 2700,
      fcpMs: 1500,
      cls: 0.1,
      inpMs: 210,
      speedIndexMs: 3400,
      ttfbMs: 480,
      tbtMs: 180,
    },
    coreWebVitals: {
      lcpMs: 2700,
      cls: 0.1,
      inpMs: 210,
      passesAssessment: false,
      lcpPass: false,
      clsPass: true,
      inpPass: true,
    },
    diagnostics: [],
    opportunities: [],
  },
  combinedCategoryScores: {
    performance: 0.82,
    accessibility: 0.89,
    bestPractices: 0.87,
    seo: 0.91,
  },
  combinedLabMetrics: {
    lcpMs: 2400,
    fcpMs: 1350,
    cls: 0.075,
    inpMs: 180,
    speedIndexMs: 3100,
    ttfbMs: 440,
    tbtMs: 160,
  },
  combinedCoreWebVitals: {
    lcpMs: 2700,
    cls: 0.1,
    inpMs: 210,
    passesAssessment: false,
    lcpPass: false,
    clsPass: true,
    inpPass: true,
  },
  diagnostics: [],
  opportunities: [],
};

const integration = {
  id: "integration-1",
  storeId: STORE_ID,
  googleAccountId: "acct-1",
  email: "merchant@store.com",
  refreshToken: "refresh",
  accessToken: "access",
  expiresAt: new Date(Date.now() + 3600_000),
  connectedAt: new Date(),
  lastSyncAt: null,
  analyticsPropertyId: "123456789",
  analyticsPropertyName: "Main Property",
  searchConsoleSiteUrl: "https://store.example.com/",
  searchConsoleSiteName: "https://store.example.com/",
  searchConsoleLastSyncAt: null,
  pageSpeedLastSyncAt: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PageSpeed sync engine integration", () => {
  beforeEach(() => {
    resetConnectorRegistry();
    resetConnectorPlatformBootstrap();
    resetGa4ConnectorDeps();
    resetGscConnectorDeps();
    resetPageSpeedConnectorDeps();
    resetClarityConnectorDeps();
    clearConnectorCache();
    bootstrapConnectorPlatform();

    configureGa4ConnectorDeps({
      loadIntegration: async () => integration,
      fetchReport: async () => mockGa4Report,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    configureGscConnectorDeps({
      loadIntegration: async () => integration,
      fetchReport: async () => mockGscReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    configurePageSpeedConnectorDeps({
      loadIntegration: async () => integration,
      resolveStoreUrl: async () => "https://store.example.com/",
      fetchReport: async () => mockPageSpeedReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    configureClarityConnectorDeps({
      loadIntegration: async () => ({
        id: "integration-clarity-1",
        storeId: STORE_ID,
        projectId: "clarity-project-1",
        projectName: "Main Store Clarity",
        apiToken: "token",
        connectedAt: new Date(),
        lastSyncAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      fetchReport: async () => mockClarityReport,
      getApiToken: () => "api-token",
      markRevoked: vi.fn(),
    });

    configureClarityConnectorDeps({
      loadIntegration: async () => ({
        id: "integration-clarity-1",
        storeId: STORE_ID,
        projectId: "clarity-project-1",
        projectName: "Main Store Clarity",
        apiToken: "token",
        connectedAt: new Date(),
        lastSyncAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      fetchReport: async () => mockClarityReport,
      getApiToken: () => "api-token",
      markRevoked: vi.fn(),
    });
  });

  it("syncs PageSpeed alongside other connectors without blocking them", async () => {
    const result = await syncStoreConnectors({ storeId: STORE_ID }, { useCache: false, forceRefresh: true });

    expect(result.metrics.pagespeed?.performance.speedScore).toBe(82);
    expect(result.metrics.ga4?.traffic.sessions).toBe(800);
    expect(result.metrics.gsc?.seo.clicks).toBe(500);
    expect(result.runs.find((run) => run.connectorId === "pagespeed")?.status).toBe("success");
  });

  it("isolates PageSpeed quota failures", async () => {
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => integration,
      resolveStoreUrl: async () => "https://store.example.com/",
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      fetchReport: async () => {
        const { GoogleApiError } = await import("../../google/shared/google-api-error");
        throw new GoogleApiError({
          code: "quota_exceeded",
          message: "quota exceeded",
          retryable: true,
        });
      },
      markRevoked: vi.fn(),
    });

    const result = await syncStoreConnectors(
      { storeId: STORE_ID },
      { useCache: false, retryAttempts: 0 },
    );

    expect(result.metrics.pagespeed).toBeUndefined();
    expect(result.metrics.ga4).toBeDefined();
    expect(result.metrics.gsc).toBeDefined();
    expect(result.runs.find((run) => run.connectorId === "pagespeed")?.status).toBe("failed");
  });
});
