import { describe, expect, it } from "vitest";

import {
  buildGscRawReport,
  parseGscReport,
  type GscFetchedReports,
} from "../search-console/gsc-parser";

function buildSampleFetchedReports(): GscFetchedReports {
  return {
    siteUrl: "https://store.example.com/",
    dateRanges: {
      last_7_days: { startDate: "2026-06-13", endDate: "2026-06-20" },
      last_30_days: { startDate: "2026-05-21", endDate: "2026-06-20" },
      previous_period: { startDate: "2026-04-21", endDate: "2026-05-20" },
    },
    summaryLast30Days: {
      rows: [{ clicks: 420, impressions: 8200, ctr: 0.0512, position: 12.4 }],
    },
    summaryLast7Days: {
      rows: [{ clicks: 110, impressions: 2100, ctr: 0.0524, position: 11.8 }],
    },
    summaryPreviousPeriod: {
      rows: [{ clicks: 380, impressions: 7600, ctr: 0.05, position: 13.1 }],
    },
    queries: {
      rows: [
        { keys: ["protein powder"], clicks: 90, impressions: 1800, ctr: 0.05, position: 8.2 },
        { keys: ["fitness bundle"], clicks: 45, impressions: 900, ctr: 0.05, position: 14.5 },
      ],
    },
    pages: {
      rows: [
        { keys: ["https://store.example.com/"], clicks: 120, impressions: 2400, ctr: 0.05, position: 10.1 },
      ],
    },
    countries: {
      rows: [{ keys: ["usa"], clicks: 300, impressions: 6000, ctr: 0.05, position: 12.0 }],
    },
    devices: {
      rows: [{ keys: ["MOBILE"], clicks: 250, impressions: 5000, ctr: 0.05, position: 11.5 }],
    },
    searchTypes: {
      rows: [{ keys: ["web"], clicks: 400, impressions: 7800, ctr: 0.051, position: 12.2 }],
    },
    coverage: {
      permissionLevel: "siteOwner",
      siteVerified: true,
    },
  };
}

describe("GSC parser", () => {
  it("normalizes Search Console data into SEO fields only", () => {
    const raw = buildGscRawReport(buildSampleFetchedReports());
    const metrics = parseGscReport(raw, "2026-06-20T12:00:00.000Z");

    expect(metrics.metadata.source).toBe("gsc");
    expect(metrics.seo.clicks).toBe(420);
    expect(metrics.seo.impressions).toBe(8200);
    expect(metrics.seo.ctr).toBe(0.0512);
    expect(metrics.seo.averagePosition).toBe(12.4);
    expect(metrics.traffic.sessions).toBe(0);
    expect(metrics.traffic.users).toBe(0);
    expect(metrics.conversion.revenue).toBe(0);
    expect(metrics.behavior).toEqual({});
    expect(raw.queries).toHaveLength(2);
    expect(raw.topPages[0]?.page).toContain("store.example.com");
  });
});
