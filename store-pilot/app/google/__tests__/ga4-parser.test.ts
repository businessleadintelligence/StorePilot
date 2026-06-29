import { describe, expect, it } from "vitest";

import {
  buildGa4RawReport,
  parseGa4Report,
  type Ga4FetchedReports,
} from "../analytics/ga4-parser";

function buildSampleFetchedReports(): Ga4FetchedReports {
  return {
    propertyId: "123456789",
    dateRanges: {
      last_7_days: { startDate: "2026-06-13", endDate: "2026-06-20" },
      last_30_days: { startDate: "2026-05-21", endDate: "2026-06-20" },
      previous_period: { startDate: "2026-04-21", endDate: "2026-05-20" },
    },
    summary: {
      metricHeaders: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "bounceRate" },
        { name: "purchaseRevenue" },
        { name: "conversions" },
        { name: "transactions" },
        { name: "averageSessionDuration" },
      ],
      rows: [
        {
          metricValues: [
            { value: "1200" },
            { value: "900" },
            { value: "0.42" },
            { value: "15000.50" },
            { value: "48" },
            { value: "40" },
            { value: "132.5" },
          ],
        },
      ],
    },
    channels: {
      rows: [
        {
          dimensionValues: [{ value: "Organic Search" }],
          metricValues: [{ value: "420" }],
        },
        {
          dimensionValues: [{ value: "Paid Search" }],
          metricValues: [{ value: "180" }],
        },
      ],
    },
    landingPages: {
      rows: [
        {
          dimensionValues: [{ value: "/" }],
          metricValues: [{ value: "300" }],
        },
        {
          dimensionValues: [{ value: "/collections/all" }],
          metricValues: [{ value: "120" }],
        },
      ],
    },
    devices: {
      rows: [
        {
          dimensionValues: [{ value: "mobile" }],
          metricValues: [{ value: "700" }],
        },
      ],
    },
    countries: {
      rows: [
        {
          dimensionValues: [{ value: "United States" }],
          metricValues: [{ value: "800" }],
        },
      ],
    },
  };
}

describe("GA4 parser", () => {
  it("normalizes GA4 API responses without changing schema shape", () => {
    const raw = buildGa4RawReport(buildSampleFetchedReports());
    const metrics = parseGa4Report(raw, "2026-06-20T12:00:00.000Z");

    expect(metrics.metadata.source).toBe("ga4");
    expect(metrics.traffic.sessions).toBe(1200);
    expect(metrics.traffic.users).toBe(900);
    expect(metrics.traffic.bounceRate).toBe(0.42);
    expect(metrics.traffic.channels).toEqual({
      "Organic Search": 420,
      "Paid Search": 180,
    });
    expect(metrics.conversion.revenue).toBe(15000.5);
    expect(metrics.conversion.rate).toBe(0.04);
    expect(metrics.conversion.aov).toBe(375.01);
    expect(metrics.behavior.topLandingPages).toEqual(["/", "/collections/all"]);
    expect(metrics.seo.clicks).toBe(0);
  });
});
