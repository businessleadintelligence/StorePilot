import { describe, expect, it } from "vitest";

import {
  buildPageSpeedRawReport,
  parsePageSpeedApiResponse,
  parsePageSpeedReport,
  type PageSpeedRawReport,
} from "../pagespeed/pagespeed-parser";

function buildSampleApiResponse(input?: {
  performanceScore?: number;
  lcpMs?: number;
  cls?: number;
  inpMs?: number;
  fcpMs?: number;
  speedIndexMs?: number;
  ttfbMs?: number;
  tbtMs?: number;
  overallCategory?: string;
}) {
  return {
    id: "https://store.example.com/",
    loadingExperience: {
      overall_category: input?.overallCategory ?? "AVERAGE",
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: {
          percentile: input?.lcpMs ?? 2400,
          category: "AVERAGE",
        },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: {
          percentile: (input?.cls ?? 0.08) * 100,
          category: "AVERAGE",
        },
        INTERACTION_TO_NEXT_PAINT: {
          percentile: input?.inpMs ?? 180,
          category: "AVERAGE",
        },
      },
    },
    lighthouseResult: {
      categories: {
        performance: { score: input?.performanceScore ?? 0.82 },
        accessibility: { score: 0.91 },
        "best-practices": { score: 0.88 },
        seo: { score: 0.93 },
      },
      audits: {
        "largest-contentful-paint": {
          numericValue: input?.lcpMs ?? 2400,
          displayValue: "2.4 s",
        },
        "cumulative-layout-shift": {
          numericValue: input?.cls ?? 0.08,
          displayValue: "0.08",
        },
        "interaction-to-next-paint": {
          numericValue: input?.inpMs ?? 180,
          displayValue: "180 ms",
        },
        "first-contentful-paint": {
          numericValue: input?.fcpMs ?? 1200,
          displayValue: "1.2 s",
        },
        "speed-index": {
          numericValue: input?.speedIndexMs ?? 3200,
          displayValue: "3.2 s",
        },
        "server-response-time": {
          numericValue: input?.ttfbMs ?? 420,
          displayValue: "420 ms",
        },
        "total-blocking-time": {
          numericValue: input?.tbtMs ?? 160,
          displayValue: "160 ms",
        },
        "render-blocking-resources": {
          title: "Eliminate render-blocking resources",
          description: "Resources are blocking the first paint.",
          displayValue: "Potential savings of 120 ms",
          score: 0.4,
          numericValue: 120,
        },
        "diagnostics-table": {
          title: "Diagnostics",
          description: "More information about the performance.",
          score: 0,
          details: { type: "table" },
        },
      },
    },
  };
}

function buildSampleRawReport(): PageSpeedRawReport {
  return buildPageSpeedRawReport({
    pageUrl: "https://store.example.com/",
    desktop: buildSampleApiResponse({
      performanceScore: 0.86,
      lcpMs: 2100,
      cls: 0.05,
      inpMs: 150,
    }),
    mobile: buildSampleApiResponse({
      performanceScore: 0.78,
      lcpMs: 2700,
      cls: 0.1,
      inpMs: 210,
    }),
  });
}

describe("PageSpeed parser", () => {
  it("parses desktop strategy metrics", () => {
    const report = parsePageSpeedApiResponse({
      strategy: "desktop",
      pageUrl: "https://store.example.com/",
      response: buildSampleApiResponse({ performanceScore: 0.86, lcpMs: 2100 }),
    });

    expect(report.strategy).toBe("desktop");
    expect(report.categoryScores.performance).toBe(0.86);
    expect(report.labMetrics.lcpMs).toBe(2100);
    expect(report.coreWebVitals.lcpMs).toBe(2100);
  });

  it("parses mobile strategy metrics", () => {
    const report = parsePageSpeedApiResponse({
      strategy: "mobile",
      pageUrl: "https://store.example.com/",
      response: buildSampleApiResponse({ performanceScore: 0.74, inpMs: 260 }),
    });

    expect(report.strategy).toBe("mobile");
    expect(report.categoryScores.performance).toBe(0.74);
    expect(report.labMetrics.inpMs).toBe(260);
  });

  it("builds combined desktop and mobile raw report", () => {
    const raw = buildSampleRawReport();

    expect(raw.desktop.strategy).toBe("desktop");
    expect(raw.mobile.strategy).toBe("mobile");
    expect(raw.combinedCategoryScores.performance).toBeCloseTo(0.82, 2);
    expect(raw.diagnostics.length).toBeGreaterThan(0);
    expect(raw.opportunities.length).toBeGreaterThan(0);
  });

  it("maps raw report into normalized performance metrics only", () => {
    const metrics = parsePageSpeedReport(buildSampleRawReport(), "2026-06-20T12:00:00.000Z");

    expect(metrics.metadata.source).toBe("pagespeed");
    expect(metrics.performance.speedScore).toBe(82);
    expect(metrics.performance.lcp).toBe(2700);
    expect(metrics.performance.cls).toBe(0.1);
    expect(metrics.performance.inp).toBe(210);
    expect(metrics.traffic.sessions).toBe(0);
    expect(metrics.conversion.revenue).toBe(0);
    expect(metrics.seo.clicks).toBe(0);
    expect(metrics.behavior).toEqual({});
  });

  it("handles missing audit values without crashing", () => {
    const metrics = parsePageSpeedReport(
      buildPageSpeedRawReport({
        pageUrl: "https://store.example.com/",
        desktop: { lighthouseResult: { categories: { performance: { score: 0.5 } }, audits: {} } },
        mobile: { lighthouseResult: { categories: { performance: { score: 0.6 } }, audits: {} } },
      }),
      "2026-06-20T12:00:00.000Z",
    );

    expect(metrics.performance.speedScore).toBe(55);
    expect(metrics.performance.lcp).toBeUndefined();
  });
});
