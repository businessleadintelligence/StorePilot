import { describe, expect, it } from "vitest";

import {
  buildClarityRawReport,
  parseClarityReport,
  type ClarityFetchedReports,
} from "../clarity/clarity-parser";

function buildSampleFetchedReports(): ClarityFetchedReports {
  return {
    projectId: "clarity-project-1",
    numOfDays: 3,
    aggregate: [
      {
        metricName: "Traffic",
        information: [{ totalSessionCount: "1200" }],
      },
      {
        metricName: "Scroll Depth",
        information: [{ averageScrollDepth: "62" }],
      },
      {
        metricName: "Rage Click Count",
        information: [{ rageClickCount: "18" }],
      },
      {
        metricName: "Dead Click Count",
        information: [{ deadClickCount: "24" }],
      },
      {
        metricName: "Quickback Click",
        information: [{ quickbackClick: "11" }],
      },
      {
        metricName: "Script Error Count",
        information: [{ scriptErrorCount: "4" }],
      },
      {
        metricName: "Engagement Time",
        information: [{ averageEngagementTime: "45" }],
      },
    ],
    pages: [
      {
        metricName: "Traffic",
        information: [
          { URL: "https://store.example.com/", totalSessionCount: "500" },
          { URL: "https://store.example.com/collections/all", totalSessionCount: "300" },
        ],
      },
      {
        metricName: "Scroll Depth",
        information: [
          { URL: "https://store.example.com/", averageScrollDepth: "70" },
          { URL: "https://store.example.com/collections/all", averageScrollDepth: "55" },
        ],
      },
      {
        metricName: "Rage Click Count",
        information: [
          { URL: "https://store.example.com/cart", rageClickCount: "10" },
        ],
      },
      {
        metricName: "Quickback Click",
        information: [
          { URL: "https://store.example.com/cart", quickbackClick: "8" },
        ],
      },
    ],
    devices: [
      {
        metricName: "Traffic",
        information: [
          { Device: "Mobile", totalSessionCount: "800" },
          { Device: "Desktop", totalSessionCount: "400" },
        ],
      },
    ],
    browsers: [
      {
        metricName: "Traffic",
        information: [{ Browser: "Chrome", totalSessionCount: "900" }],
      },
    ],
    countries: [
      {
        metricName: "Traffic",
        information: [{ "Country/Region": "United States", totalSessionCount: "700" }],
      },
    ],
  };
}

describe("Clarity parser", () => {
  it("builds aggregated raw report without visitor identifiers", () => {
    const raw = buildClarityRawReport(buildSampleFetchedReports());

    expect(raw.projectId).toBe("clarity-project-1");
    expect(raw.summary.sessions).toBe(1200);
    expect(raw.summary.rageClicks).toBe(18);
    expect(raw.summary.scrollDepth).toBeCloseTo(0.62, 2);
    expect(raw.deviceBreakdown.Mobile).toBe(800);
    expect(raw.pageAggregates[0]?.path).toBe("/");
    expect(raw.heatmapAvailable).toBe(true);
    expect(raw.recordingAvailable).toBe(true);
    expect(JSON.stringify(raw)).not.toContain("SessionId");
  });

  it("maps raw report into behavior metrics only", () => {
    const metrics = parseClarityReport(buildClarityRawReport(buildSampleFetchedReports()));

    expect(metrics.metadata.source).toBe("clarity");
    expect(metrics.behavior.rageClicks).toBe(18);
    expect(metrics.behavior.scrollDepth).toBeCloseTo(0.62, 2);
    expect(metrics.behavior.topLandingPages?.[0]).toBe("/");
    expect(metrics.behavior.exitPages?.[0]).toBe("/cart");
    expect(metrics.traffic.sessions).toBe(0);
    expect(metrics.traffic.users).toBe(0);
    expect(metrics.conversion.revenue).toBe(0);
    expect(metrics.seo.clicks).toBe(0);
    expect(metrics.performance).toEqual({});
  });

  it("handles missing metric blocks gracefully", () => {
    const metrics = parseClarityReport(
      buildClarityRawReport({
        ...buildSampleFetchedReports(),
        aggregate: [],
        pages: [],
        devices: [],
        browsers: [],
        countries: [],
      }),
    );

    expect(metrics.behavior.rageClicks).toBeUndefined();
    expect(metrics.behavior.scrollDepth).toBeUndefined();
  });
});
