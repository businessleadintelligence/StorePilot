export type Ga4DateRangeKey = "last_7_days" | "last_30_days" | "previous_period";

export type Ga4DateRange = {
  startDate: string;
  endDate: string;
};

export type Ga4RunReportRequest = {
  dateRanges: Ga4DateRange[];
  metrics: Array<{ name: string }>;
  dimensions?: Array<{ name: string }>;
  limit?: string;
  keepEmptyRows?: boolean;
};

export type Ga4ReportQuerySet = {
  summary: Ga4RunReportRequest;
  channels: Ga4RunReportRequest;
  landingPages: Ga4RunReportRequest;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

export function buildGa4DateRanges(referenceDate = new Date()): Record<Ga4DateRangeKey, Ga4DateRange> {
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

export function buildGa4ReportQueries(referenceDate = new Date()): Ga4ReportQuerySet {
  const ranges = buildGa4DateRanges(referenceDate);

  return {
    summary: {
      dateRanges: [ranges.last_30_days, ranges.last_7_days, ranges.previous_period],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "bounceRate" },
        { name: "purchaseRevenue" },
        { name: "conversions" },
        { name: "transactions" },
        { name: "averageSessionDuration" },
      ],
      keepEmptyRows: true,
    },
    channels: {
      dateRanges: [ranges.last_30_days],
      metrics: [{ name: "sessions" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      limit: "20",
    },
    landingPages: {
      dateRanges: [ranges.last_30_days],
      metrics: [{ name: "sessions" }],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      limit: "10",
    },
  };
}

export function normalizeGa4PropertyId(propertyId: string): string {
  return propertyId.replace(/^properties\//, "");
}

export function toGa4PropertyResourceName(propertyId: string): string {
  const normalized = normalizeGa4PropertyId(propertyId);
  return `properties/${normalized}`;
}
