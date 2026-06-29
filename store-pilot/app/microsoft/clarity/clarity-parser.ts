import type { NormalizedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import { sanitizeClarityPagePath } from "./clarity-query-builder";

export type ClarityApiMetricBlock = {
  metricName?: string;
  information?: Array<Record<string, string | number | null | undefined>>;
};

export type ClarityApiResponse = ClarityApiMetricBlock[];

export type ClarityPageAggregate = {
  path: string;
  sessions: number;
  scrollDepth: number;
  rageClicks: number;
  deadClicks: number;
  quickBacks: number;
  scriptErrors: number;
};

export type ClaritySegmentBreakdown = Record<string, number>;

export type ClaritySummaryMetrics = {
  sessions: number;
  engagedSessions: number;
  averageEngagementSeconds: number;
  scrollDepth: number;
  deadClicks: number;
  rageClicks: number;
  quickBacks: number;
  scriptErrors: number;
};

export type ClarityRawReport = {
  projectId: string;
  numOfDays: number;
  summary: ClaritySummaryMetrics;
  deviceBreakdown: ClaritySegmentBreakdown;
  browserBreakdown: ClaritySegmentBreakdown;
  countryBreakdown: ClaritySegmentBreakdown;
  pageAggregates: ClarityPageAggregate[];
  heatmapAvailable: boolean;
  recordingAvailable: boolean;
};

export type ClarityFetchedReports = {
  projectId: string;
  numOfDays: number;
  aggregate: ClarityApiResponse;
  pages: ClarityApiResponse;
  devices: ClarityApiResponse;
  browsers: ClarityApiResponse;
  countries: ClarityApiResponse;
};

const METRIC_ALIASES: Record<string, string[]> = {
  traffic: ["traffic"],
  scrollDepth: ["scroll depth"],
  engagementTime: ["engagement time"],
  rageClickCount: ["rage click count"],
  deadClickCount: ["dead click count"],
  quickbackClick: ["quickback click"],
  scriptErrorCount: ["script error count"],
  popularPages: ["popular pages"],
};

function normalizeMetricName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function readNumeric(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function readAverageNumeric(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function readSumNumeric(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function findMetricBlocks(response: ClarityApiResponse, aliases: string[]): ClarityApiMetricBlock[] {
  const normalizedAliases = new Set(aliases.map((alias) => alias.toLowerCase()));
  return response.filter((block) => normalizedAliases.has(normalizeMetricName(block.metricName)));
}

function readMetricRows(response: ClarityApiResponse, aliases: string[]): Array<Record<string, string | number | null | undefined>> {
  return findMetricBlocks(response, aliases).flatMap((block) => block.information ?? []);
}

function readAggregateMetric(response: ClarityApiResponse, aliases: string[], fieldNames: string[]): number {
  const rows = readMetricRows(response, aliases);
  const values = rows.flatMap((row) => fieldNames.map((field) => readNumeric(row[field])));
  return readSumNumeric(values);
}

function readAverageMetric(response: ClarityApiResponse, aliases: string[], fieldNames: string[]): number {
  const rows = readMetricRows(response, aliases);
  const values = rows.flatMap((row) => fieldNames.map((field) => readNumeric(row[field])));
  return readAverageNumeric(values.filter((value) => value > 0));
}

function readDimensionBreakdown(
  response: ClarityApiResponse,
  dimensionKey: string,
): ClaritySegmentBreakdown {
  const rows = readMetricRows(response, METRIC_ALIASES.traffic);
  const breakdown: ClaritySegmentBreakdown = {};

  for (const row of rows) {
    const label = String(row[dimensionKey] ?? "").trim();
    if (!label) continue;
    breakdown[label] = (breakdown[label] ?? 0) + readNumeric(row.totalSessionCount);
  }

  return breakdown;
}

function normalizeScrollDepth(value: number): number {
  if (value <= 0) return 0;
  if (value <= 1) return Number(value.toFixed(4));
  if (value <= 100) return Number((value / 100).toFixed(4));
  return 1;
}

function readPageAggregates(pagesResponse: ClarityApiResponse): ClarityPageAggregate[] {
  const pageMap = new Map<string, ClarityPageAggregate>();

  const upsertPage = (rawUrl: string): ClarityPageAggregate => {
    const path = sanitizeClarityPagePath(rawUrl);
    const existing = pageMap.get(path);
    if (existing) return existing;

    const created: ClarityPageAggregate = {
      path,
      sessions: 0,
      scrollDepth: 0,
      rageClicks: 0,
      deadClicks: 0,
      quickBacks: 0,
      scriptErrors: 0,
    };
    pageMap.set(path, created);
    return created;
  };

  for (const row of readMetricRows(pagesResponse, METRIC_ALIASES.traffic)) {
    const rawUrl = String(row.URL ?? row.url ?? row.pageUrl ?? "").trim();
    if (!rawUrl) continue;
    const page = upsertPage(rawUrl);
    page.sessions += readNumeric(row.totalSessionCount);
  }

  for (const row of readMetricRows(pagesResponse, METRIC_ALIASES.scrollDepth)) {
    const rawUrl = String(row.URL ?? row.url ?? row.pageUrl ?? "").trim();
    if (!rawUrl) continue;
    const page = upsertPage(rawUrl);
    page.scrollDepth = normalizeScrollDepth(readNumeric(row.averageScrollDepth ?? row.scrollDepth));
  }

  for (const row of readMetricRows(pagesResponse, METRIC_ALIASES.rageClickCount)) {
    const rawUrl = String(row.URL ?? row.url ?? row.pageUrl ?? "").trim();
    if (!rawUrl) continue;
    upsertPage(rawUrl).rageClicks += readNumeric(row.rageClickCount ?? row.count);
  }

  for (const row of readMetricRows(pagesResponse, METRIC_ALIASES.deadClickCount)) {
    const rawUrl = String(row.URL ?? row.url ?? row.pageUrl ?? "").trim();
    if (!rawUrl) continue;
    upsertPage(rawUrl).deadClicks += readNumeric(row.deadClickCount ?? row.count);
  }

  for (const row of readMetricRows(pagesResponse, METRIC_ALIASES.quickbackClick)) {
    const rawUrl = String(row.URL ?? row.url ?? row.pageUrl ?? "").trim();
    if (!rawUrl) continue;
    upsertPage(rawUrl).quickBacks += readNumeric(row.quickbackClick ?? row.count);
  }

  for (const row of readMetricRows(pagesResponse, METRIC_ALIASES.scriptErrorCount)) {
    const rawUrl = String(row.URL ?? row.url ?? row.pageUrl ?? "").trim();
    if (!rawUrl) continue;
    upsertPage(rawUrl).scriptErrors += readNumeric(row.scriptErrorCount ?? row.count);
  }

  return [...pageMap.values()].sort((left, right) => right.sessions - left.sessions);
}

function readTopLandingPages(pageAggregates: ClarityPageAggregate[], limit = 5): string[] {
  return pageAggregates
    .filter((page) => page.sessions > 0)
    .slice(0, limit)
    .map((page) => page.path);
}

function readExitPages(pageAggregates: ClarityPageAggregate[], limit = 5): string[] {
  return [...pageAggregates]
    .filter((page) => page.quickBacks > 0 || page.rageClicks > 0)
    .sort((left, right) => right.quickBacks + right.rageClicks - (left.quickBacks + left.rageClicks))
    .slice(0, limit)
    .map((page) => page.path);
}

export function buildClarityRawReport(input: ClarityFetchedReports): ClarityRawReport {
  const sessions = readAggregateMetric(input.aggregate, METRIC_ALIASES.traffic, [
    "totalSessionCount",
  ]);
  const engagedSessions = readAggregateMetric(input.aggregate, METRIC_ALIASES.engagementTime, [
    "engagedSessionCount",
    "totalSessionCount",
  ]);
  const averageEngagementSeconds = readAverageMetric(input.aggregate, METRIC_ALIASES.engagementTime, [
    "averageEngagementTime",
    "activeTime",
    "engagementTime",
  ]);
  const scrollDepth = normalizeScrollDepth(
    readAverageMetric(input.aggregate, METRIC_ALIASES.scrollDepth, [
      "averageScrollDepth",
      "scrollDepth",
    ]),
  );
  const deadClicks = readAggregateMetric(input.aggregate, METRIC_ALIASES.deadClickCount, [
    "deadClickCount",
    "count",
  ]);
  const rageClicks = readAggregateMetric(input.aggregate, METRIC_ALIASES.rageClickCount, [
    "rageClickCount",
    "count",
  ]);
  const quickBacks = readAggregateMetric(input.aggregate, METRIC_ALIASES.quickbackClick, [
    "quickbackClick",
    "quickBackCount",
    "count",
  ]);
  const scriptErrors = readAggregateMetric(input.aggregate, METRIC_ALIASES.scriptErrorCount, [
    "scriptErrorCount",
    "count",
  ]);

  const pageAggregates = readPageAggregates(input.pages);

  return {
    projectId: input.projectId,
    numOfDays: input.numOfDays,
    summary: {
      sessions,
      engagedSessions: engagedSessions > 0 ? engagedSessions : sessions,
      averageEngagementSeconds,
      scrollDepth: scrollDepth || readAverageNumeric(pageAggregates.map((page) => page.scrollDepth)),
      deadClicks,
      rageClicks,
      quickBacks,
      scriptErrors,
    },
    deviceBreakdown: readDimensionBreakdown(input.devices, "Device"),
    browserBreakdown: readDimensionBreakdown(input.browsers, "Browser"),
    countryBreakdown: readDimensionBreakdown(input.countries, "Country/Region"),
    pageAggregates,
    heatmapAvailable: pageAggregates.length > 0 && sessions > 0,
    recordingAvailable: sessions > 0,
  };
}

export function parseClarityReport(
  report: ClarityRawReport,
  syncedAt = new Date().toISOString(),
): NormalizedStoreMetrics {
  const topLandingPages = readTopLandingPages(report.pageAggregates);
  const exitPages = readExitPages(report.pageAggregates);

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
      clicks: 0,
      impressions: 0,
      ctr: 0,
      averagePosition: 0,
    },
    performance: {},
    behavior: {
      topLandingPages: topLandingPages.length > 0 ? topLandingPages : undefined,
      exitPages: exitPages.length > 0 ? exitPages : undefined,
      rageClicks: report.summary.rageClicks > 0 ? report.summary.rageClicks : undefined,
      scrollDepth: report.summary.scrollDepth > 0 ? report.summary.scrollDepth : undefined,
    },
    metadata: {
      source: "clarity",
      lastSyncedAt: syncedAt,
      dataQualityScore: 0,
    },
  };
}
