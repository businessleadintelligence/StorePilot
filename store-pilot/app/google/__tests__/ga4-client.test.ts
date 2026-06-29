import { beforeEach, describe, expect, it } from "vitest";

import { fetchGa4AnalyticsReport, resetGa4ClientDeps } from "../analytics/ga4-client";
import type { Ga4RunReportRequest } from "../analytics/ga4-query-builder";

describe("GA4 client", () => {
  beforeEach(() => {
    resetGa4ClientDeps();
  });

  it("requests summary, channel, landing page, device, and country reports", async () => {
    const requests: Ga4RunReportRequest[] = [];

    const { configureGa4ClientDeps } = await import("../analytics/ga4-client");
    configureGa4ClientDeps({
      runReport: async ({ request }) => {
        requests.push(request);
        return {
          metricHeaders: [{ name: "sessions" }],
          rows: [{ metricValues: [{ value: "100" }] }],
        };
      },
    });

    await fetchGa4AnalyticsReport({
      propertyId: "123456789",
      accessToken: "access-token",
    });

    expect(requests.length).toBe(5);
    expect(requests[0]?.metrics?.map((metric) => metric.name)).toContain("purchaseRevenue");
    expect(requests[1]?.dimensions?.[0]?.name).toBe("sessionDefaultChannelGroup");
    expect(requests[2]?.dimensions?.[0]?.name).toBe("landingPagePlusQueryString");
  });
});
