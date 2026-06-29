import type { GoogleIntegration } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildConnectorDataQualityWarnings,
  applyGoogleAnalyticsMissingPenalty,
  applySearchConsoleMissingPenalty,
} from "../../connectors/core/data-quality-warnings";
import {
  configureGa4ConnectorDeps,
  createGa4Connector,
  resetGa4ConnectorDeps,
  type Ga4RawReport,
} from "../../connectors/google/ga4.connector";
import { GoogleApiError } from "../shared/google-api-error";
import { sanitizeGoogleLogContext } from "../oauth/google-token.service";

const STORE_ID = "store-ga4-test";
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
  analyticsPropertyName: "Main Store Property",
  searchConsoleSiteUrl: null,
  searchConsoleSiteName: null,
  searchConsoleLastSyncAt: null,
  pageSpeedLastSyncAt: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies GoogleIntegration;

const mockRawReport: Ga4RawReport = {
  propertyId: "123456789",
  dateRanges: {
    last_7_days: { startDate: "2026-06-13", endDate: "2026-06-20" },
    last_30_days: { startDate: "2026-05-21", endDate: "2026-06-20" },
    previous_period: { startDate: "2026-04-21", endDate: "2026-05-20" },
  },
  metrics: {
    sessions: 500,
    totalUsers: 420,
    bounceRate: 0.38,
    purchaseRevenue: 4200,
    conversions: 20,
    transactions: 18,
    averageSessionDuration: 95,
  },
  channelBreakdown: { Organic: 200 },
  landingPages: ["/"],
  deviceCategories: { mobile: 300 },
  countries: { "United States": 400 },
};

describe("Production GA4 connector", () => {
  beforeEach(() => {
    resetGa4ConnectorDeps();
    configureGa4ConnectorDeps({
      loadIntegration: async () => mockIntegration,
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });
  });

  it("fetches and transforms production GA4 data", async () => {
    const connector = createGa4Connector({ storeId: STORE_ID });
    await connector.connect();
    const metrics = connector.transform(await connector.fetch());

    expect(metrics.traffic.sessions).toBe(500);
    expect(metrics.metadata.source).toBe("ga4");
    expect(connector.validate(metrics)).toBe(true);
  });

  it("marks revoked consent without crashing", async () => {
    const markRevoked = vi.fn();
    configureGa4ConnectorDeps({
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

    const connector = createGa4Connector({ storeId: STORE_ID });
    await connector.connect();

    await expect(connector.fetch()).rejects.toMatchObject({ code: "revoked_consent" });
    expect(markRevoked).toHaveBeenCalledWith(STORE_ID, "revoked");
  });

  it("fails gracefully when property is missing", async () => {
    configureGa4ConnectorDeps({
      loadIntegration: async () => null,
      fetchReport: async () => mockRawReport,
      getAccessToken: async () => ({
        accessToken: "access-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markRevoked: vi.fn(),
    });

    const connector = createGa4Connector({ storeId: STORE_ID });
    await expect(connector.connect()).rejects.toMatchObject({ code: "missing_property" });
  });
});

describe("Google data quality warnings", () => {
  it("returns deterministic warnings when GA4 is missing", () => {
    const warnings = buildConnectorDataQualityWarnings({
      presentConnectorIds: ["gsc", "pagespeed", "clarity"],
    });

    expect(warnings[0]?.code).toBe("google_analytics_missing");
    expect(warnings[0]?.impacts).toContain("Revenue Intelligence accuracy reduced");
    expect(warnings[0]?.impacts).toContain("Executive COO confidence reduced");
  });

  it("reduces score when analytics is missing", () => {
    expect(applyGoogleAnalyticsMissingPenalty(90, false)).toBe(78);
    expect(applyGoogleAnalyticsMissingPenalty(90, true)).toBe(90);
    expect(applySearchConsoleMissingPenalty(90, false)).toBe(80);
  });
});

describe("Google logging safety", () => {
  it("never logs token fields", () => {
    const sanitized = sanitizeGoogleLogContext({
      storeId: STORE_ID,
      accessToken: "secret",
      refreshToken: "secret",
      operation: "google_oauth_completed",
    });

    expect(sanitized.accessToken).toBeUndefined();
    expect(sanitized.refreshToken).toBeUndefined();
    expect(sanitized.operation).toBe("google_oauth_completed");
  });
});
