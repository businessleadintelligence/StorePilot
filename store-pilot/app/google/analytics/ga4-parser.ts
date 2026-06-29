import type { NormalizedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import type { Ga4DateRangeKey } from "./ga4-query-builder";

export type Ga4RawReport = {
  propertyId: string;
  dateRanges: Record<Ga4DateRangeKey, { startDate: string; endDate: string }>;
  metrics: {
    sessions: number;
    totalUsers: number;
    bounceRate: number;
    purchaseRevenue: number;
    conversions: number;
    transactions: number;
    averageSessionDuration: number;
  };
  channelBreakdown: Record<string, number>;
  landingPages: string[];
  deviceCategories: Record<string, number>;
  countries: Record<string, number>;
};

type Ga4MetricValue = {
  value?: string;
};

type Ga4ReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Ga4MetricValue[];
};

type Ga4RunReportResponse = {
  rows?: Ga4ReportRow[];
  metricHeaders?: Array<{ name?: string }>;
};

export type Ga4FetchedReports = {
  propertyId: string;
  dateRanges: Ga4RawReport["dateRanges"];
  summary: Ga4RunReportResponse;
  channels: Ga4RunReportResponse;
  landingPages: Ga4RunReportResponse;
  devices: Ga4RunReportResponse;
  countries: Ga4RunReportResponse;
};

function parseMetricNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readSummaryMetrics(response: Ga4RunReportResponse, rangeIndex = 0): Ga4RawReport["metrics"] {
  const headers = response.metricHeaders?.map((header) => header.name ?? "") ?? [];
  const row = response.rows?.[rangeIndex];
  const values = row?.metricValues ?? [];

  const readMetric = (metricName: string): number => {
    const index = headers.indexOf(metricName);
    return index >= 0 ? parseMetricNumber(values[index]?.value) : 0;
  };

  return {
    sessions: readMetric("sessions"),
    totalUsers: readMetric("totalUsers"),
    bounceRate: readMetric("bounceRate"),
    purchaseRevenue: readMetric("purchaseRevenue"),
    conversions: readMetric("conversions"),
    transactions: readMetric("transactions"),
    averageSessionDuration: readMetric("averageSessionDuration"),
  };
}

function readDimensionBreakdown(response: Ga4RunReportResponse): Record<string, number> {
  const breakdown: Record<string, number> = {};

  for (const row of response.rows ?? []) {
    const key = row.dimensionValues?.[0]?.value;
    if (!key) continue;
    breakdown[key] = parseMetricNumber(row.metricValues?.[0]?.value);
  }

  return breakdown;
}

function readLandingPages(response: Ga4RunReportResponse, limit = 5): string[] {
  return (response.rows ?? [])
    .map((row) => row.dimensionValues?.[0]?.value)
    .filter((value): value is string => Boolean(value))
    .slice(0, limit);
}

export function buildGa4RawReport(input: Ga4FetchedReports): Ga4RawReport {
  return {
    propertyId: input.propertyId,
    dateRanges: input.dateRanges,
    metrics: readSummaryMetrics(input.summary, 0),
    channelBreakdown: readDimensionBreakdown(input.channels),
    landingPages: readLandingPages(input.landingPages),
    deviceCategories: readDimensionBreakdown(input.devices),
    countries: readDimensionBreakdown(input.countries),
  };
}

export function parseGa4Report(
  report: Ga4RawReport,
  syncedAt = new Date().toISOString(),
): NormalizedStoreMetrics {
  const sessions = report.metrics.sessions;
  const conversionRate = sessions > 0 ? report.metrics.conversions / sessions : 0;
  const aov = report.metrics.transactions > 0
    ? report.metrics.purchaseRevenue / report.metrics.transactions
    : 0;

  return {
    traffic: {
      sessions: report.metrics.sessions,
      users: report.metrics.totalUsers,
      bounceRate: report.metrics.bounceRate,
      channels: Object.keys(report.channelBreakdown).length > 0 ? report.channelBreakdown : undefined,
    },
    conversion: {
      rate: Number(conversionRate.toFixed(4)),
      revenue: Number(report.metrics.purchaseRevenue.toFixed(2)),
      aov: Number(aov.toFixed(2)),
    },
    seo: {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      averagePosition: 0,
    },
    performance: {},
    behavior: {
      topLandingPages: report.landingPages.length > 0 ? report.landingPages : undefined,
    },
    metadata: {
      source: "ga4",
      lastSyncedAt: syncedAt,
      dataQualityScore: 0,
    },
  };
}
