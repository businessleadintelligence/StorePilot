import type { NormalizedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import type { GscDateRangeKey } from "./gsc-query-builder";

export type GscSearchAnalyticsRow = {
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  searchType?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSummaryMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscCoverageSummary = {
  permissionLevel: string | null;
  siteVerified: boolean;
};

export type GscRawReport = {
  siteUrl: string;
  dateRanges: Record<GscDateRangeKey, { startDate: string; endDate: string }>;
  summary: GscSummaryMetrics;
  summaryLast7Days: GscSummaryMetrics;
  summaryPreviousPeriod: GscSummaryMetrics;
  queries: GscSearchAnalyticsRow[];
  topPages: GscSearchAnalyticsRow[];
  countries: GscSearchAnalyticsRow[];
  devices: GscSearchAnalyticsRow[];
  searchTypes: GscSearchAnalyticsRow[];
  coverage: GscCoverageSummary;
};

type GscApiRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type GscSearchAnalyticsResponse = {
  rows?: GscApiRow[];
  responseAggregationType?: string;
};

export type GscFetchedReports = {
  siteUrl: string;
  dateRanges: GscRawReport["dateRanges"];
  summaryLast30Days: GscSearchAnalyticsResponse;
  summaryLast7Days: GscSearchAnalyticsResponse;
  summaryPreviousPeriod: GscSearchAnalyticsResponse;
  queries: GscSearchAnalyticsResponse;
  pages: GscSearchAnalyticsResponse;
  countries: GscSearchAnalyticsResponse;
  devices: GscSearchAnalyticsResponse;
  searchTypes: GscSearchAnalyticsResponse;
  coverage: GscCoverageSummary;
};

function readSummaryMetrics(response: GscSearchAnalyticsResponse): GscSummaryMetrics {
  const row = response.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

function readDimensionRows(
  response: GscSearchAnalyticsResponse,
  dimension: keyof Pick<GscSearchAnalyticsRow, "query" | "page" | "country" | "device" | "searchType">,
): GscSearchAnalyticsRow[] {
  return (response.rows ?? []).map((row) => ({
    [dimension]: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export function buildGscRawReport(input: GscFetchedReports): GscRawReport {
  return {
    siteUrl: input.siteUrl,
    dateRanges: input.dateRanges,
    summary: readSummaryMetrics(input.summaryLast30Days),
    summaryLast7Days: readSummaryMetrics(input.summaryLast7Days),
    summaryPreviousPeriod: readSummaryMetrics(input.summaryPreviousPeriod),
    queries: readDimensionRows(input.queries, "query"),
    topPages: readDimensionRows(input.pages, "page"),
    countries: readDimensionRows(input.countries, "country"),
    devices: readDimensionRows(input.devices, "device"),
    searchTypes: readDimensionRows(input.searchTypes, "searchType"),
    coverage: input.coverage,
  };
}

export function parseGscReport(
  report: GscRawReport,
  syncedAt = new Date().toISOString(),
): NormalizedStoreMetrics {
  const { summary } = report;

  return {
    traffic: {
      sessions: 0,
      users: 0,
    },
    conversion: {
      rate: 0,
      revenue: 0,
      aov: 0,
    },
    seo: {
      clicks: summary.clicks,
      impressions: summary.impressions,
      ctr: Number(summary.ctr.toFixed(4)),
      averagePosition: Number(summary.position.toFixed(2)),
    },
    performance: {},
    behavior: {},
    metadata: {
      source: "gsc",
      lastSyncedAt: syncedAt,
      dataQualityScore: 0,
    },
  };
}
