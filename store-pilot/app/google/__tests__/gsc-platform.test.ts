import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureGscConnectorDeps,
  createSearchConsoleConnector,
  resetGscConnectorDeps,
  type GscRawReport,
} from "../../connectors/google/search-console.connector";
import { GoogleApiError } from "../shared/google-api-error";
import {
  applySearchConsoleMissingPenalty,
  buildConnectorDataQualityWarnings,
} from "../../connectors/core/data-quality-warnings";
import type { GoogleIntegration } from "@prisma/client";

const STORE_ID = "store-gsc-test";

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

const mockRawReport: GscRawReport = {
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

describe("Production Search Console connector", () => {
  beforeEach(() => {
    resetGscConnectorDeps();
    configureGscConnectorDeps({
      loadIntegration: async () => mockIntegration,
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });
  });

  it("fetches and transforms production GSC data", async () => {
    const connector = createSearchConsoleConnector({ storeId: STORE_ID });
    await connector.connect();
    const metrics = connector.transform(await connector.fetch());

    expect(metrics.seo.clicks).toBe(500);
    expect(metrics.seo.impressions).toBe(9000);
    expect(metrics.metadata.source).toBe("gsc");
    expect(connector.validate(metrics)).toBe(true);
  });

  it("fails gracefully when property is missing", async () => {
    configureGscConnectorDeps({
      loadIntegration: async () => null,
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    const connector = createSearchConsoleConnector({ storeId: STORE_ID });
    await expect(connector.connect()).rejects.toMatchObject({ code: "missing_property" });
  });

  it("handles permission denied without crashing", async () => {
    configureGscConnectorDeps({
      loadIntegration: async () => mockIntegration,
      fetchReport: async () => {
        throw new GoogleApiError({
          code: "permission_denied",
          message: "permission denied",
          retryable: false,
        });
      },
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    const connector = createSearchConsoleConnector({ storeId: STORE_ID });
    await connector.connect();
    await expect(connector.fetch()).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("handles revoked consent", async () => {
    const markRevoked = vi.fn();
    configureGscConnectorDeps({
      loadIntegration: async () => mockIntegration,
      getAccessToken: async () => {
        throw new GoogleApiError({
          code: "revoked_consent",
          message: "revoked",
          retryable: false,
        });
      },
      fetchReport: async () => mockRawReport,
      markRevoked,
    });

    const connector = createSearchConsoleConnector({ storeId: STORE_ID });
    await connector.connect();
    await expect(connector.fetch()).rejects.toMatchObject({ code: "revoked_consent" });
    expect(markRevoked).toHaveBeenCalledWith(STORE_ID, "revoked");
  });
});

describe("Search Console data quality", () => {
  it("emits deterministic warnings when GSC is missing", () => {
    const warnings = buildConnectorDataQualityWarnings({
      presentConnectorIds: ["ga4", "pagespeed", "clarity"],
    });

    expect(warnings.some((warning) => warning.code === "search_console_missing")).toBe(true);
    expect(warnings.find((warning) => warning.code === "search_console_missing")?.impacts).toContain(
      "SEO recommendations are based on catalog only",
    );
  });

  it("reduces score when Search Console is missing", () => {
    expect(applySearchConsoleMissingPenalty(90, false)).toBe(80);
    expect(applySearchConsoleMissingPenalty(90, true)).toBe(90);
  });
});
