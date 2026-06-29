import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureClarityConnectorDeps,
  createClarityConnector,
  resetClarityConnectorDeps,
  type ClarityRawReport,
} from "../../connectors/microsoft/clarity.connector";
import { ClarityApiError } from "../clarity/clarity-api-error";
import {
  applyClarityMissingPenalty,
  buildConnectorDataQualityWarnings,
} from "../../connectors/core/data-quality-warnings";
import type { MicrosoftClarityIntegration } from "@prisma/client";

const STORE_ID = "store-clarity-test";

const mockIntegration = {
  id: "integration-1",
  storeId: STORE_ID,
  projectId: "clarity-project-1",
  projectName: "Main Store Clarity",
  apiToken: "encrypted-token",
  connectedAt: new Date(),
  lastSyncAt: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies MicrosoftClarityIntegration;

const mockRawReport: ClarityRawReport = {
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
  deviceBreakdown: { Mobile: 800, Desktop: 400 },
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

describe("Production Clarity connector", () => {
  beforeEach(() => {
    resetClarityConnectorDeps();
    configureClarityConnectorDeps({
      loadIntegration: async () => mockIntegration,
      fetchReport: async () => mockRawReport,
      getApiToken: () => "api-token",
      markRevoked: vi.fn(),
    });
  });

  it("fetches and transforms production Clarity data", async () => {
    const connector = createClarityConnector({ storeId: STORE_ID });
    await connector.connect();
    const metrics = connector.transform(await connector.fetch());

    expect(metrics.behavior.rageClicks).toBe(18);
    expect(metrics.behavior.scrollDepth).toBeCloseTo(0.62, 2);
    expect(metrics.metadata.source).toBe("clarity");
    expect(metrics.traffic.sessions).toBe(0);
    expect(connector.validate(metrics)).toBe(true);
  });

  it("fails gracefully when project is missing", async () => {
    configureClarityConnectorDeps({
      loadIntegration: async () => null,
      fetchReport: async () => mockRawReport,
      getApiToken: () => "api-token",
      markRevoked: vi.fn(),
    });

    const connector = createClarityConnector({ storeId: STORE_ID });
    await expect(connector.connect()).rejects.toMatchObject({ code: "missing_project" });
  });

  it("handles revoked credentials", async () => {
    const markRevoked = vi.fn();
    configureClarityConnectorDeps({
      loadIntegration: async () => mockIntegration,
      fetchReport: async () => {
        throw new ClarityApiError({
          code: "revoked_credentials",
          message: "revoked",
          retryable: false,
        });
      },
      getApiToken: () => {
        throw new ClarityApiError({
          code: "revoked_credentials",
          message: "revoked",
          retryable: false,
        });
      },
      markRevoked,
    });

    const connector = createClarityConnector({ storeId: STORE_ID });
    await connector.connect();
    await expect(connector.fetch()).rejects.toMatchObject({ code: "revoked_credentials" });
    expect(markRevoked).toHaveBeenCalledWith(STORE_ID, "revoked");
  });

  it("handles quota exceeded and timeouts", async () => {
    configureClarityConnectorDeps({
      loadIntegration: async () => mockIntegration,
      fetchReport: async () => {
        throw new ClarityApiError({
          code: "quota_exceeded",
          message: "Exceeded daily limit",
          retryable: true,
        });
      },
      getApiToken: () => "api-token",
      markRevoked: vi.fn(),
    });

    const connector = createClarityConnector({ storeId: STORE_ID });
    await connector.connect();
    await expect(connector.fetch()).rejects.toMatchObject({ code: "quota_exceeded" });
  });
});

describe("Clarity data quality", () => {
  it("emits deterministic warnings when Clarity is missing", () => {
    const warnings = buildConnectorDataQualityWarnings({
      presentConnectorIds: ["ga4", "gsc", "pagespeed"],
    });

    expect(warnings.some((warning) => warning.code === "clarity_missing")).toBe(true);
    expect(warnings.find((warning) => warning.code === "clarity_missing")?.impacts).toContain(
      "Behavior analysis unavailable",
    );
  });

  it("reduces score when Clarity is missing", () => {
    expect(applyClarityMissingPenalty(90, false)).toBe(82);
    expect(applyClarityMissingPenalty(90, true)).toBe(90);
  });
});
