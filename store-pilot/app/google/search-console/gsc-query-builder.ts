export type GscDateRangeKey = "last_7_days" | "last_30_days" | "previous_period";

export type GscDateRange = {
  startDate: string;
  endDate: string;
};

export type GscSearchAnalyticsRequest = {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  searchType?: string;
  rowLimit?: number;
  startRow?: number;
  aggregationType?: "auto" | "byPage" | "byProperty" | "byNewsShowcasePanel";
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

export function buildGscDateRanges(referenceDate = new Date()): Record<GscDateRangeKey, GscDateRange> {
  const endDate = formatDate(referenceDate);
  const last7Start = formatDate(subtractDays(referenceDate, 7));
  const last30Start = formatDate(subtractDays(referenceDate, 30));
  const previousPeriodEnd = formatDate(subtractDays(referenceDate, 31));
  const previousPeriodStart = formatDate(subtractDays(referenceDate, 60));

  return {
    last_7_days: { startDate: last7Start, endDate },
    last_30_days: { startDate: last30Start, endDate },
    previous_period: { startDate: previousPeriodStart, endDate: previousPeriodEnd },
  };
}

export type GscQuerySet = {
  summaryLast30Days: GscSearchAnalyticsRequest;
  summaryLast7Days: GscSearchAnalyticsRequest;
  summaryPreviousPeriod: GscSearchAnalyticsRequest;
  queries: GscSearchAnalyticsRequest;
  pages: GscSearchAnalyticsRequest;
  countries: GscSearchAnalyticsRequest;
  devices: GscSearchAnalyticsRequest;
  searchTypes: GscSearchAnalyticsRequest;
};

export function buildGscSearchAnalyticsQueries(referenceDate = new Date()): GscQuerySet {
  const ranges = buildGscDateRanges(referenceDate);

  return {
    summaryLast30Days: {
      startDate: ranges.last_30_days.startDate,
      endDate: ranges.last_30_days.endDate,
    },
    summaryLast7Days: {
      startDate: ranges.last_7_days.startDate,
      endDate: ranges.last_7_days.endDate,
    },
    summaryPreviousPeriod: {
      startDate: ranges.previous_period.startDate,
      endDate: ranges.previous_period.endDate,
    },
    queries: {
      startDate: ranges.last_30_days.startDate,
      endDate: ranges.last_30_days.endDate,
      dimensions: ["query"],
      rowLimit: 25,
    },
    pages: {
      startDate: ranges.last_30_days.startDate,
      endDate: ranges.last_30_days.endDate,
      dimensions: ["page"],
      rowLimit: 10,
    },
    countries: {
      startDate: ranges.last_30_days.startDate,
      endDate: ranges.last_30_days.endDate,
      dimensions: ["country"],
      rowLimit: 10,
    },
    devices: {
      startDate: ranges.last_30_days.startDate,
      endDate: ranges.last_30_days.endDate,
      dimensions: ["device"],
      rowLimit: 10,
    },
    searchTypes: {
      startDate: ranges.last_30_days.startDate,
      endDate: ranges.last_30_days.endDate,
      dimensions: ["searchAppearance"],
      rowLimit: 10,
    },
  };
}

export function encodeGscSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}
