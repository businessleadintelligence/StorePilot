import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapConnectorPlatform,
  clearConnectorCache,
  resetConnectorPlatformBootstrap,
  resetConnectorRegistry,
  syncStoreConnectors,
} from "../../connectors";
import {
  configureClarityConnectorDeps,
  resetClarityConnectorDeps,
  type ClarityRawReport,
} from "../../connectors/microsoft/clarity.connector";
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

const STORE_ID = "store-clarity-sync-test";

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
  ],
  heatmapAvailable: true,
  recordingAvailable: true,
};

const integration = {
  id: "integration-1",
  storeId: STORE_ID,
  projectId: "clarity-project-1",
  projectName: "Main Store Clarity",
  apiToken: "token",
  connectedAt: new Date(),
  lastSyncAt: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Clarity sync engine integration", () => {
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
      loadIntegration: async () => null,
      fetchReport: async () => ({}) as Ga4RawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });
    configureGscConnectorDeps({
      loadIntegration: async () => null,
      fetchReport: async () => ({}) as GscRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => null,
      resolveStoreUrl: async () => null,
      fetchReport: async () => ({}) as PageSpeedRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });
    configureClarityConnectorDeps({
      loadIntegration: async () => integration,
      fetchReport: async () => mockClarityReport,
      getApiToken: () => "api-token",
      markRevoked: vi.fn(),
    });
  });

  it("syncs Clarity without blocking other connectors", async () => {
    const result = await syncStoreConnectors(
      { storeId: STORE_ID, projectId: "clarity-project-1" },
      { connectorIds: ["clarity"], useCache: false, forceRefresh: true },
    );

    expect(result.metrics.clarity?.behavior.rageClicks).toBe(18);
    expect(result.runs.find((run) => run.connectorId === "clarity")?.status).toBe("success");
  });

  it("isolates Clarity quota failures", async () => {
    configureClarityConnectorDeps({
      loadIntegration: async () => integration,
      getApiToken: () => "api-token",
      fetchReport: async () => {
        const { ClarityApiError } = await import("../../microsoft/clarity/clarity-api-error");
        throw new ClarityApiError({
          code: "quota_exceeded",
          message: "Exceeded daily limit",
          retryable: true,
        });
      },
      markRevoked: vi.fn(),
    });

    const result = await syncStoreConnectors(
      { storeId: STORE_ID, projectId: "clarity-project-1" },
      { connectorIds: ["clarity"], useCache: false, retryAttempts: 0 },
    );

    expect(result.metrics.clarity).toBeUndefined();
    expect(result.runs.find((run) => run.connectorId === "clarity")?.status).toBe("failed");
  });
});
