import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  configurePageSpeedConnectorDeps,
  createPageSpeedConnector,
  resetPageSpeedConnectorDeps,
  type PageSpeedRawReport,
} from "../../connectors/google/pagespeed.connector";
import { GoogleApiError } from "../shared/google-api-error";
import {
  applyPageSpeedMissingPenalty,
  buildConnectorDataQualityWarnings,
} from "../../connectors/core/data-quality-warnings";
import type { GoogleIntegration } from "@prisma/client";

const STORE_ID = "store-pagespeed-test";

const mockIntegration = {
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
} satisfies GoogleIntegration;

const mockRawReport: PageSpeedRawReport = {
  pageUrl: "https://store.example.com/",
  desktop: {
    strategy: "desktop",
    pageUrl: "https://store.example.com/",
    categoryScores: {
      performance: 0.86,
      accessibility: 0.9,
      bestPractices: 0.88,
      seo: 0.92,
    },
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
    categoryScores: {
      performance: 0.78,
      accessibility: 0.88,
      bestPractices: 0.86,
      seo: 0.9,
    },
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

describe("Production PageSpeed connector", () => {
  beforeEach(() => {
    resetPageSpeedConnectorDeps();
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => mockIntegration,
      resolveStoreUrl: async () => "https://store.example.com/",
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });
  });

  it("fetches and transforms production PageSpeed data", async () => {
    const connector = createPageSpeedConnector({ storeId: STORE_ID });
    await connector.connect();
    const metrics = connector.transform(await connector.fetch());

    expect(metrics.performance.speedScore).toBe(82);
    expect(metrics.performance.lcp).toBe(2700);
    expect(metrics.metadata.source).toBe("pagespeed");
    expect(connector.validate(metrics)).toBe(true);
  });

  it("fails gracefully when integration is missing", async () => {
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => null,
      resolveStoreUrl: async () => "https://store.example.com/",
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    const connector = createPageSpeedConnector({ storeId: STORE_ID });
    await expect(connector.connect()).rejects.toMatchObject({ code: "missing_property" });
  });

  it("fails gracefully when storefront URL is missing", async () => {
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => mockIntegration,
      resolveStoreUrl: async () => null,
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    const connector = createPageSpeedConnector({ storeId: STORE_ID });
    await expect(connector.connect()).rejects.toMatchObject({ code: "missing_property" });
  });

  it("handles quota exceeded without crashing", async () => {
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => mockIntegration,
      resolveStoreUrl: async () => "https://store.example.com/",
      fetchReport: async () => {
        throw new GoogleApiError({
          code: "quota_exceeded",
          message: "quota exceeded",
          retryable: true,
        });
      },
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    const connector = createPageSpeedConnector({ storeId: STORE_ID });
    await connector.connect();
    await expect(connector.fetch()).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("handles timeouts and rate limiting", async () => {
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => mockIntegration,
      resolveStoreUrl: async () => "https://store.example.com/",
      fetchReport: async () => {
        throw new GoogleApiError({
          code: "rate_limited",
          message: "rate limited",
          retryable: true,
        });
      },
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    const connector = createPageSpeedConnector({ storeId: STORE_ID });
    await connector.connect();
    await expect(connector.fetch()).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("handles revoked consent", async () => {
    const markRevoked = vi.fn();
    configurePageSpeedConnectorDeps({
      loadIntegration: async () => mockIntegration,
      resolveStoreUrl: async () => "https://store.example.com/",
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => {
        throw new GoogleApiError({
          code: "revoked_consent",
          message: "revoked",
          retryable: false,
        });
      },
      markRevoked,
    });

    const connector = createPageSpeedConnector({ storeId: STORE_ID });
    await connector.connect();
    await expect(connector.fetch()).rejects.toMatchObject({ code: "revoked_consent" });
    expect(markRevoked).toHaveBeenCalledWith(STORE_ID, "revoked");
  });
});

describe("PageSpeed data quality", () => {
  it("emits deterministic warnings when PageSpeed is missing", () => {
    const warnings = buildConnectorDataQualityWarnings({
      presentConnectorIds: ["ga4", "gsc", "clarity"],
    });

    expect(warnings.some((warning) => warning.code === "pagespeed_missing")).toBe(true);
    expect(warnings.find((warning) => warning.code === "pagespeed_missing")?.impacts).toContain(
      "Core Web Vitals unavailable",
    );
  });

  it("reduces score when PageSpeed is missing", () => {
    expect(applyPageSpeedMissingPenalty(90, false)).toBe(82);
    expect(applyPageSpeedMissingPenalty(90, true)).toBe(90);
  });
});
