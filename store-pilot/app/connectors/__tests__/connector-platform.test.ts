import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapConnectorPlatform,
  clearConnectorCache,
  computeConnectorDataQualityScore,
  computeUnifiedDataQuality,
  configureGa4ConnectorDeps,
  configureGscConnectorDeps,
  configurePageSpeedConnectorDeps,
  configureClarityConnectorDeps,
  createGa4Connector,
  createClarityConnector,
  createPageSpeedConnector,
  createSearchConsoleConnector,
  getCachedUnifiedMetrics,
  getConnector,
  getConnectorStatus,
  listRegisteredConnectors,
  mergeCombinedMetrics,
  registerConnector,
  resetConnectorPlatformBootstrap,
  resetConnectorRegistry,
  resetGa4ConnectorDeps,
  resetGscConnectorDeps,
  resetPageSpeedConnectorDeps,
  resetClarityConnectorDeps,
  runAllConnectors,
  setCachedUnifiedMetrics,
  syncStoreConnectors,
  validateNormalizedStoreMetrics,
  type BaseConnector,
  type ConnectorContext,
  type NormalizedStoreMetrics,
} from "../index";
import { AbstractConnector } from "../core/connector.interface";
import { createInitialConnectorHealth } from "../core/connector-health";
import type { Ga4RawReport } from "../google/ga4.connector";
import type { GscRawReport } from "../google/search-console.connector";
import type { PageSpeedRawReport } from "../google/pagespeed.connector";
import type { ClarityRawReport } from "../microsoft/clarity.connector";

const STORE_ID = "store-connector-test-001";
const CONTEXT: ConnectorContext = { storeId: STORE_ID };

const MOCK_GA4_REPORT: Ga4RawReport = {
  propertyId: "123456789",
  dateRanges: {
    last_7_days: { startDate: "2026-06-13", endDate: "2026-06-20" },
    last_30_days: { startDate: "2026-05-21", endDate: "2026-06-20" },
    previous_period: { startDate: "2026-04-21", endDate: "2026-05-20" },
  },
  metrics: {
    sessions: 1200,
    totalUsers: 900,
    bounceRate: 0.42,
    purchaseRevenue: 15000,
    conversions: 48,
    transactions: 40,
    averageSessionDuration: 120,
  },
  channelBreakdown: {
    organic: 400,
    direct: 250,
    paid: 180,
    social: 90,
  },
  landingPages: ["/"],
  deviceCategories: { mobile: 700 },
  countries: { "United States": 800 },
};

const MOCK_GSC_REPORT: GscRawReport = {
  siteUrl: "https://store.example.com/",
  dateRanges: {
    last_7_days: { startDate: "2026-06-13", endDate: "2026-06-20" },
    last_30_days: { startDate: "2026-05-21", endDate: "2026-06-20" },
    previous_period: { startDate: "2026-04-21", endDate: "2026-05-20" },
  },
  summary: { clicks: 320, impressions: 6400, ctr: 0.05, position: 11.2 },
  summaryLast7Days: { clicks: 80, impressions: 1600, ctr: 0.05, position: 10.8 },
  summaryPreviousPeriod: { clicks: 280, impressions: 5600, ctr: 0.05, position: 12.0 },
  queries: [{ query: "protein powder", clicks: 90, impressions: 1800, ctr: 0.05, position: 8.2 }],
  topPages: [{ page: "https://store.example.com/", clicks: 120, impressions: 2400, ctr: 0.05, position: 10.1 }],
  countries: [],
  devices: [],
  searchTypes: [],
  coverage: { permissionLevel: "siteOwner", siteVerified: true },
};

const MOCK_PAGESPEED_REPORT: PageSpeedRawReport = {
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

const MOCK_CLARITY_REPORT: ClarityRawReport = {
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
  pageAggregates: [
    {
      path: "/",
      sessions: 500,
      scrollDepth: 0.7,
      rageClicks: 2,
      deadClicks: 3,
      quickBacks: 1,
      scriptErrors: 0,
    },
    {
      path: "/cart",
      sessions: 120,
      scrollDepth: 0.4,
      rageClicks: 10,
      deadClicks: 5,
      quickBacks: 8,
      scriptErrors: 2,
    },
  ],
  heatmapAvailable: true,
  recordingAvailable: true,
};

function configureDefaultGa4ConnectorMocks(): void {
  resetGa4ConnectorDeps();
  configureGa4ConnectorDeps({
    loadIntegration: async () => ({
      id: "integration-1",
      storeId: STORE_ID,
      googleAccountId: "google-account-1",
      email: "merchant@store.com",
      refreshToken: "encrypted-refresh",
      accessToken: "encrypted-access",
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
    }),
    fetchReport: async () => MOCK_GA4_REPORT,
    getAccessToken: async () => ({
      accessToken: "access-token",
      expiresAt: new Date(Date.now() + 3600_000),
    }),
    markRevoked: async () => undefined,
  });
}

function configureDefaultGscConnectorMocks(): void {
  resetGscConnectorDeps();
  configureGscConnectorDeps({
    loadIntegration: async () => ({
      id: "integration-1",
      storeId: STORE_ID,
      googleAccountId: "google-account-1",
      email: "merchant@store.com",
      refreshToken: "encrypted-refresh",
      accessToken: "encrypted-access",
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
    }),
    fetchReport: async () => MOCK_GSC_REPORT,
    getAccessToken: async () => ({
      accessToken: "access-token",
      expiresAt: new Date(Date.now() + 3600_000),
    }),
    markRevoked: async () => undefined,
  });
}

function configureDefaultPageSpeedConnectorMocks(): void {
  resetPageSpeedConnectorDeps();
  configurePageSpeedConnectorDeps({
    loadIntegration: async () => ({
      id: "integration-1",
      storeId: STORE_ID,
      googleAccountId: "google-account-1",
      email: "merchant@store.com",
      refreshToken: "encrypted-refresh",
      accessToken: "encrypted-access",
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
    }),
    resolveStoreUrl: async () => "https://store.example.com/",
    fetchReport: async () => MOCK_PAGESPEED_REPORT,
    getAccessToken: async () => ({
      accessToken: "access-token",
      expiresAt: new Date(Date.now() + 3600_000),
    }),
    markRevoked: async () => undefined,
  });
}

function configureDefaultClarityConnectorMocks(): void {
  resetClarityConnectorDeps();
  configureClarityConnectorDeps({
    loadIntegration: async () => ({
      id: "integration-clarity-1",
      storeId: STORE_ID,
      projectId: "clarity-project-1",
      projectName: "Main Store Clarity",
      apiToken: "encrypted-token",
      connectedAt: new Date(),
      lastSyncAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    fetchReport: async () => MOCK_CLARITY_REPORT,
    getApiToken: () => "api-token",
    markRevoked: async () => undefined,
  });
}

class FailingConnector extends AbstractConnector {
  readonly id = "ga4";

  async connect(): Promise<void> {}

  async fetch(): Promise<unknown> {
    throw new Error("fetch_failed");
  }

  transform(): NormalizedStoreMetrics {
    throw new Error("should_not_transform");
  }

  getHealth() {
    return createInitialConnectorHealth();
  }
}

describe("External Connector Platform", () => {
  beforeEach(() => {
    resetConnectorRegistry();
    resetConnectorPlatformBootstrap();
    clearConnectorCache();
    configureDefaultGa4ConnectorMocks();
    configureDefaultGscConnectorMocks();
    configureDefaultPageSpeedConnectorMocks();
    configureDefaultClarityConnectorMocks();
    bootstrapConnectorPlatform();
  });

  it("registers all default connectors", () => {
    expect(listRegisteredConnectors().sort()).toEqual(["clarity", "ga4", "gsc", "pagespeed"]);
  });

  it("implements BaseConnector for each default connector", () => {
    const connectors: BaseConnector[] = [
      createGa4Connector(CONTEXT),
      createSearchConsoleConnector(CONTEXT),
      createPageSpeedConnector(CONTEXT),
      createClarityConnector(CONTEXT),
    ];

    for (const connector of connectors) {
      expect(typeof connector.id).toBe("string");
      expect(typeof connector.connect).toBe("function");
      expect(typeof connector.fetch).toBe("function");
      expect(typeof connector.transform).toBe("function");
      expect(typeof connector.validate).toBe("function");
      expect(typeof connector.getHealth).toBe("function");
    }
  });

  it("transforms mock GA4 data into normalized metrics", async () => {
    const connector = createGa4Connector(CONTEXT);
    await connector.connect();
    const raw = await connector.fetch();
    const metrics = connector.transform(raw);

    expect(metrics.metadata.source).toBe("ga4");
    expect(metrics.traffic.sessions).toBeGreaterThan(0);
    expect(metrics.conversion.revenue).toBeGreaterThan(0);
    expect(connector.validate(metrics)).toBe(true);
    expect(validateNormalizedStoreMetrics(metrics)).toBe(true);
  });

  it("transforms mock Search Console data into normalized metrics", async () => {
    const connector = createSearchConsoleConnector(CONTEXT);
    await connector.connect();
    const metrics = connector.transform(await connector.fetch());

    expect(metrics.metadata.source).toBe("gsc");
    expect(metrics.seo.clicks).toBeGreaterThan(0);
    expect(metrics.seo.impressions).toBeGreaterThan(metrics.seo.clicks);
  });

  it("transforms production PageSpeed data into normalized metrics", async () => {
    const connector = createPageSpeedConnector(CONTEXT);
    await connector.connect();
    const metrics = connector.transform(await connector.fetch());

    expect(metrics.metadata.source).toBe("pagespeed");
    expect(metrics.performance.speedScore).toBe(82);
    expect(metrics.performance.lcp).toBeGreaterThan(0);
  });

  it("transforms production Clarity data into normalized metrics", async () => {
    const connector = createClarityConnector(CONTEXT);
    await connector.connect();
    const metrics = connector.transform(await connector.fetch());

    expect(metrics.metadata.source).toBe("clarity");
    expect(metrics.behavior.rageClicks).toBe(18);
    expect(metrics.behavior.topLandingPages?.length).toBeGreaterThan(0);
    expect(metrics.traffic.sessions).toBe(0);
  });

  it("runs all connectors in parallel via registry", async () => {
    const runs = await runAllConnectors({ context: CONTEXT });

    expect(runs).toHaveLength(4);
    expect(runs.every((run) => run.status === "success")).toBe(true);
    expect(runs.every((run) => run.metrics && validateNormalizedStoreMetrics(run.metrics))).toBe(true);
  });

  it("builds unified store metrics with combined sections", async () => {
    const result = await syncStoreConnectors(CONTEXT, { useCache: false });

    expect(result.fromCache).toBe(false);
    expect(result.metrics.ga4).toBeDefined();
    expect(result.metrics.gsc).toBeDefined();
    expect(result.metrics.pagespeed).toBeDefined();
    expect(result.metrics.clarity).toBeDefined();
    expect(result.metrics.combined.traffic.sessions).toBeGreaterThan(0);
    expect(result.metrics.combined.seo.clicks).toBeGreaterThan(0);
    expect(result.metrics.combined.performance.speedScore).toBeGreaterThan(0);
    expect(result.metrics.combined.behavior.rageClicks).toBeGreaterThanOrEqual(0);
    expect(result.metrics.dataQuality.score).toBeGreaterThan(0);
    expect(result.metrics.dataQuality.missingConnectors).toEqual([]);
  });

  it("merges connector metrics deterministically", async () => {
    const first = await syncStoreConnectors(CONTEXT, { useCache: false });
    const second = await syncStoreConnectors({ storeId: "store-connector-test-001" }, { useCache: false });

    expect(first.metrics.combined.traffic.sessions).toBe(second.metrics.combined.traffic.sessions);
    expect(first.metrics.combined.conversion.revenue).toBe(second.metrics.combined.conversion.revenue);
  });

  it("isolates connector failures without breaking successful connectors", async () => {
    resetConnectorRegistry();
    registerConnector("ga4", () => new FailingConnector());
    registerConnector("gsc", createSearchConsoleConnector);
    registerConnector("pagespeed", createPageSpeedConnector);
    registerConnector("clarity", createClarityConnector);

    const result = await syncStoreConnectors(CONTEXT, { useCache: false, retryAttempts: 0 });

    expect(result.runs.find((run) => run.connectorId === "ga4")?.status).toBe("failed");
    expect(result.metrics.gsc).toBeDefined();
    expect(result.metrics.pagespeed).toBeDefined();
    expect(result.metrics.clarity).toBeDefined();
    expect(result.metrics.ga4).toBeUndefined();
    expect(result.metrics.dataQuality.missingConnectors).toContain("ga4");
  });

  it("retries failed connectors during sync", async () => {
    let attempts = 0;

    class FlakyConnector extends AbstractConnector {
      readonly id = "ga4";

      async connect(): Promise<void> {}

      async fetch(): Promise<unknown> {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("temporary_failure");
        }
        const ga4 = createGa4Connector(CONTEXT);
        await ga4.connect();
        return ga4.fetch();
      }

      transform(raw: unknown): NormalizedStoreMetrics {
        return createGa4Connector(CONTEXT).transform(raw);
      }

      getHealth() {
        return createInitialConnectorHealth();
      }
    }

    resetConnectorRegistry();
    registerConnector("ga4", () => new FlakyConnector());
    registerConnector("gsc", createSearchConsoleConnector);
    registerConnector("pagespeed", createPageSpeedConnector);
    registerConnector("clarity", createClarityConnector);

    const result = await syncStoreConnectors(CONTEXT, {
      useCache: false,
      retryAttempts: 2,
      retryDelayMs: 0,
    });

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(result.metrics.ga4).toBeDefined();
  });

  it("caches unified metrics per storeId", async () => {
    const first = await syncStoreConnectors(CONTEXT, { useCache: true, forceRefresh: true });
    const second = await syncStoreConnectors(CONTEXT, { useCache: true });

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.metrics.lastSyncAt).toBe(first.metrics.lastSyncAt);
  });

  it("exposes connector health status", async () => {
    await syncStoreConnectors(CONTEXT, { useCache: false });
    const statuses = getConnectorStatus(STORE_ID);

    expect(statuses).toHaveLength(4);
    expect(statuses.every((status) => status.registered)).toBe(true);
    expect(statuses.every((status) => status.health.lastSuccessSync)).toBeTruthy();
  });

  it("computes deterministic data quality scores without AI", () => {
    const metrics: NormalizedStoreMetrics = {
      traffic: { sessions: 1000, users: 800, bounceRate: 0.4, channels: { organic: 400 } },
      conversion: { rate: 0.03, revenue: 5000, aov: 120 },
      seo: { clicks: 300, impressions: 5000, ctr: 0.06, averagePosition: 12.4 },
      performance: { speedScore: 82, lcp: 2200, cls: 0.05, inp: 180 },
      behavior: { rageClicks: 10, scrollDepth: 0.62, topLandingPages: ["/"] },
      metadata: { source: "ga4", lastSyncedAt: new Date().toISOString(), dataQualityScore: 0 },
    };

    metrics.metadata.dataQualityScore = computeConnectorDataQualityScore(metrics);
    expect(metrics.metadata.dataQualityScore).toBeGreaterThanOrEqual(70);

    const unifiedQuality = computeUnifiedDataQuality({
      presentConnectorIds: ["ga4", "gsc", "pagespeed", "clarity"],
      connectorHealth: {
        ga4: { ...createInitialConnectorHealth(), status: "healthy", lastSuccessSync: new Date().toISOString(), errorRate: 0 },
        gsc: { ...createInitialConnectorHealth(), status: "healthy", lastSuccessSync: new Date().toISOString(), errorRate: 0 },
        pagespeed: { ...createInitialConnectorHealth(), status: "healthy", lastSuccessSync: new Date().toISOString(), errorRate: 0 },
        clarity: { ...createInitialConnectorHealth(), status: "healthy", lastSuccessSync: new Date().toISOString(), errorRate: 0 },
      },
    });

    expect(unifiedQuality.score).toBeGreaterThan(0);
    expect(unifiedQuality.completenessScore).toBe(100);
    expect(unifiedQuality.missingConnectors).toEqual([]);
  });

  it("merges combined metrics from partial connector set", async () => {
    const runs = await runAllConnectors({
      context: CONTEXT,
      connectorIds: ["gsc", "pagespeed"],
    });
    const metrics = runs
      .filter((run) => run.metrics)
      .map((run) => run.metrics!) ;

    const combined = mergeCombinedMetrics(metrics);
    expect(combined.seo.clicks).toBeGreaterThan(0);
    expect(combined.performance.speedScore).toBeGreaterThan(0);
  });

  it("supports manual cache lookup", async () => {
    const synced = await syncStoreConnectors(CONTEXT, { useCache: true, forceRefresh: true });
    setCachedUnifiedMetrics(STORE_ID, synced.metrics, 60_000);
    expect(getCachedUnifiedMetrics(STORE_ID)?.combined.traffic.sessions).toBeGreaterThan(0);
  });

  it("does not mutate connector registry when getConnector is called", () => {
    const connector = getConnector("ga4", CONTEXT);
    expect(connector.id).toBe("ga4");
  });

  it("uses deterministic mock values for identical storeId", async () => {
    const first = await syncStoreConnectors({ storeId: "deterministic-store" }, { useCache: false });
    clearConnectorCache();
    resetConnectorRegistry();
    resetConnectorPlatformBootstrap();
    configureDefaultGa4ConnectorMocks();
    configureDefaultGscConnectorMocks();
    configureDefaultPageSpeedConnectorMocks();
    configureDefaultClarityConnectorMocks();
    bootstrapConnectorPlatform();
    const second = await syncStoreConnectors({ storeId: "deterministic-store" }, { useCache: false });

    expect(first.metrics.ga4?.traffic.sessions).toBe(second.metrics.ga4?.traffic.sessions);
    expect(first.metrics.gsc?.seo.clicks).toBe(second.metrics.gsc?.seo.clicks);
  });
});

describe("Connector platform guardrails", () => {
  it("does not import AI platform modules", async () => {
    const source = await vi.importActual<typeof import("../index")>("../index");
    expect(Object.keys(source)).not.toContain("execute");
    expect(Object.keys(source)).not.toContain("ai-orchestrator");
  });
});
