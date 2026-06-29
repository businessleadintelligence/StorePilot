import { beforeEach, describe, expect, it } from "vitest";

import { fetchGscSearchConsoleReport, resetGscClientDeps } from "../search-console/gsc-client";
import type { GscSearchAnalyticsRequest } from "../search-console/gsc-query-builder";

describe("GSC client", () => {
  beforeEach(() => {
    resetGscClientDeps();
  });

  it("requests summary and dimension reports for Search Console", async () => {
    const requests: GscSearchAnalyticsRequest[] = [];

    const { configureGscClientDeps } = await import("../search-console/gsc-client");
    configureGscClientDeps({
      runSearchAnalytics: async ({ request }) => {
        requests.push(request);
        return {
          rows: [{ clicks: 10, impressions: 100, ctr: 0.1, position: 5 }],
        };
      },
      fetchSiteCoverage: async () => ({
        permissionLevel: "siteOwner",
        siteVerified: true,
      }),
      listSites: async () => [],
    });

    await fetchGscSearchConsoleReport({
      siteUrl: "https://store.example.com/",
      accessToken: "access-token",
    });

    expect(requests.length).toBe(8);
    expect(requests.some((request) => request.dimensions?.includes("query"))).toBe(true);
    expect(requests.some((request) => request.dimensions?.includes("page"))).toBe(true);
    expect(requests.some((request) => request.dimensions?.includes("country"))).toBe(true);
  });
});
