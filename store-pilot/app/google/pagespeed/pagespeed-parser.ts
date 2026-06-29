import type { NormalizedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import type { PageSpeedStrategy } from "./pagespeed-query-builder";

export type PageSpeedCategoryScores = {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
};

export type PageSpeedLabMetrics = {
  lcpMs: number | null;
  fcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  speedIndexMs: number | null;
  ttfbMs: number | null;
  tbtMs: number | null;
};

export type PageSpeedDiagnostic = {
  id: string;
  title: string;
  description: string;
  displayValue: string | null;
};

export type PageSpeedOpportunity = {
  id: string;
  title: string;
  description: string;
  displayValue: string | null;
  score: number | null;
};

export type PageSpeedCoreWebVitals = {
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  passesAssessment: boolean;
  lcpPass: boolean;
  clsPass: boolean;
  inpPass: boolean;
};

export type PageSpeedStrategyReport = {
  strategy: PageSpeedStrategy;
  pageUrl: string;
  categoryScores: PageSpeedCategoryScores;
  labMetrics: PageSpeedLabMetrics;
  coreWebVitals: PageSpeedCoreWebVitals;
  diagnostics: PageSpeedDiagnostic[];
  opportunities: PageSpeedOpportunity[];
};

export type PageSpeedRawReport = {
  pageUrl: string;
  desktop: PageSpeedStrategyReport;
  mobile: PageSpeedStrategyReport;
  combinedCategoryScores: PageSpeedCategoryScores;
  combinedLabMetrics: PageSpeedLabMetrics;
  combinedCoreWebVitals: PageSpeedCoreWebVitals;
  diagnostics: PageSpeedDiagnostic[];
  opportunities: PageSpeedOpportunity[];
};

type PageSpeedApiAudit = {
  id?: string;
  title?: string;
  description?: string;
  displayValue?: string;
  numericValue?: number;
  score?: number | null;
  details?: {
    type?: string;
  };
};

type PageSpeedApiCategory = {
  score?: number | null;
};

type PageSpeedApiResponse = {
  id?: string;
  loadingExperience?: {
    metrics?: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile?: number; category?: string };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile?: number; category?: string };
      INTERACTION_TO_NEXT_PAINT?: { percentile?: number; category?: string };
    };
    overall_category?: string;
  };
  lighthouseResult?: {
    categories?: {
      performance?: PageSpeedApiCategory;
      accessibility?: PageSpeedApiCategory;
      "best-practices"?: PageSpeedApiCategory;
      seo?: PageSpeedApiCategory;
    };
    audits?: Record<string, PageSpeedApiAudit>;
  };
};

function readAuditNumericValue(
  audits: Record<string, PageSpeedApiAudit> | undefined,
  auditId: string,
): number | null {
  const value = audits?.[auditId]?.numericValue;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readCategoryScore(
  category: PageSpeedApiCategory | undefined,
): number | null {
  if (typeof category?.score !== "number" || !Number.isFinite(category.score)) {
    return null;
  }

  return category.score;
}

function readMetricCategoryPass(category: string | undefined): boolean {
  return category === "FAST";
}

function readCoreWebVitalsFromResponse(response: PageSpeedApiResponse): PageSpeedCoreWebVitals {
  const fieldMetrics = response.loadingExperience?.metrics;
  const audits = response.lighthouseResult?.audits;

  const lcpMs =
    fieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ??
    readAuditNumericValue(audits, "largest-contentful-paint");
  const clsRaw =
    fieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ??
    readAuditNumericValue(audits, "cumulative-layout-shift");
  const cls = typeof clsRaw === "number" ? clsRaw / 100 : null;
  const inpMs =
    fieldMetrics?.INTERACTION_TO_NEXT_PAINT?.percentile ??
    readAuditNumericValue(audits, "interaction-to-next-paint");

  const lcpPass = readMetricCategoryPass(fieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS?.category);
  const clsPass = readMetricCategoryPass(fieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category);
  const inpPass = readMetricCategoryPass(fieldMetrics?.INTERACTION_TO_NEXT_PAINT?.category);
  const passesAssessment =
    response.loadingExperience?.overall_category === "FAST" ||
    (lcpPass && clsPass && inpPass);

  return {
    lcpMs,
    cls,
    inpMs,
    passesAssessment,
    lcpPass,
    clsPass,
    inpPass,
  };
}

function readCategoryScores(response: PageSpeedApiResponse): PageSpeedCategoryScores {
  const categories = response.lighthouseResult?.categories;

  return {
    performance: readCategoryScore(categories?.performance),
    accessibility: readCategoryScore(categories?.accessibility),
    bestPractices: readCategoryScore(categories?.["best-practices"]),
    seo: readCategoryScore(categories?.seo),
  };
}

function readLabMetrics(response: PageSpeedApiResponse): PageSpeedLabMetrics {
  const audits = response.lighthouseResult?.audits;

  return {
    lcpMs: readAuditNumericValue(audits, "largest-contentful-paint"),
    fcpMs: readAuditNumericValue(audits, "first-contentful-paint"),
    cls: readAuditNumericValue(audits, "cumulative-layout-shift"),
    inpMs: readAuditNumericValue(audits, "interaction-to-next-paint"),
    speedIndexMs: readAuditNumericValue(audits, "speed-index"),
    ttfbMs: readAuditNumericValue(audits, "server-response-time"),
    tbtMs: readAuditNumericValue(audits, "total-blocking-time"),
  };
}

function readDiagnostics(response: PageSpeedApiResponse): PageSpeedDiagnostic[] {
  const audits = response.lighthouseResult?.audits ?? {};

  return Object.entries(audits)
    .filter(([, audit]) => audit.details?.type === "table" || audit.score === 0)
    .slice(0, 10)
    .map(([id, audit]) => ({
      id,
      title: audit.title ?? id,
      description: audit.description ?? "",
      displayValue: audit.displayValue ?? null,
    }));
}

function readOpportunities(response: PageSpeedApiResponse): PageSpeedOpportunity[] {
  const audits = response.lighthouseResult?.audits ?? {};

  return Object.entries(audits)
    .filter(
      ([, audit]) =>
        typeof audit.numericValue === "number" &&
        typeof audit.score === "number" &&
        audit.score < 1,
    )
    .slice(0, 10)
    .map(([id, audit]) => ({
      id,
      title: audit.title ?? id,
      description: audit.description ?? "",
      displayValue: audit.displayValue ?? null,
      score: typeof audit.score === "number" ? audit.score : null,
    }));
}

export function parsePageSpeedApiResponse(input: {
  strategy: PageSpeedStrategy;
  pageUrl: string;
  response: PageSpeedApiResponse;
}): PageSpeedStrategyReport {
  return {
    strategy: input.strategy,
    pageUrl: input.pageUrl,
    categoryScores: readCategoryScores(input.response),
    labMetrics: readLabMetrics(input.response),
    coreWebVitals: readCoreWebVitalsFromResponse(input.response),
    diagnostics: readDiagnostics(input.response),
    opportunities: readOpportunities(input.response),
  };
}

function averageNullable(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => typeof value === "number");
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function averageCategoryScores(
  desktop: PageSpeedCategoryScores,
  mobile: PageSpeedCategoryScores,
): PageSpeedCategoryScores {
  return {
    performance: averageNullable([desktop.performance, mobile.performance]),
    accessibility: averageNullable([desktop.accessibility, mobile.accessibility]),
    bestPractices: averageNullable([desktop.bestPractices, mobile.bestPractices]),
    seo: averageNullable([desktop.seo, mobile.seo]),
  };
}

function averageLabMetrics(
  desktop: PageSpeedLabMetrics,
  mobile: PageSpeedLabMetrics,
): PageSpeedLabMetrics {
  return {
    lcpMs: averageNullable([desktop.lcpMs, mobile.lcpMs]),
    fcpMs: averageNullable([desktop.fcpMs, mobile.fcpMs]),
    cls: averageNullable([desktop.cls, mobile.cls]),
    inpMs: averageNullable([desktop.inpMs, mobile.inpMs]),
    speedIndexMs: averageNullable([desktop.speedIndexMs, mobile.speedIndexMs]),
    ttfbMs: averageNullable([desktop.ttfbMs, mobile.ttfbMs]),
    tbtMs: averageNullable([desktop.tbtMs, mobile.tbtMs]),
  };
}

function combineCoreWebVitals(
  desktop: PageSpeedCoreWebVitals,
  mobile: PageSpeedCoreWebVitals,
): PageSpeedCoreWebVitals {
  return {
    lcpMs: mobile.lcpMs ?? desktop.lcpMs,
    cls: mobile.cls ?? desktop.cls,
    inpMs: mobile.inpMs ?? desktop.inpMs,
    passesAssessment: mobile.passesAssessment && desktop.passesAssessment,
    lcpPass: mobile.lcpPass && desktop.lcpPass,
    clsPass: mobile.clsPass && desktop.clsPass,
    inpPass: mobile.inpPass && desktop.inpPass,
  };
}

export function buildPageSpeedRawReport(input: {
  pageUrl: string;
  desktop: PageSpeedApiResponse;
  mobile: PageSpeedApiResponse;
}): PageSpeedRawReport {
  const desktop = parsePageSpeedApiResponse({
    strategy: "desktop",
    pageUrl: input.pageUrl,
    response: input.desktop,
  });
  const mobile = parsePageSpeedApiResponse({
    strategy: "mobile",
    pageUrl: input.pageUrl,
    response: input.mobile,
  });

  const combinedCategoryScores = averageCategoryScores(
    desktop.categoryScores,
    mobile.categoryScores,
  );
  const combinedLabMetrics = averageLabMetrics(desktop.labMetrics, mobile.labMetrics);
  const combinedCoreWebVitals = combineCoreWebVitals(
    desktop.coreWebVitals,
    mobile.coreWebVitals,
  );

  return {
    pageUrl: input.pageUrl,
    desktop,
    mobile,
    combinedCategoryScores,
    combinedLabMetrics,
    combinedCoreWebVitals,
    diagnostics: [...mobile.diagnostics, ...desktop.diagnostics].slice(0, 10),
    opportunities: [...mobile.opportunities, ...desktop.opportunities].slice(0, 10),
  };
}

export function parsePageSpeedReport(
  report: PageSpeedRawReport,
  syncedAt = new Date().toISOString(),
): NormalizedStoreMetrics {
  const performanceScore = report.combinedCategoryScores.performance;
  const coreWebVitals = report.combinedCoreWebVitals;

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
    performance: {
      lcp: coreWebVitals.lcpMs ?? report.combinedLabMetrics.lcpMs ?? undefined,
      cls: coreWebVitals.cls ?? report.combinedLabMetrics.cls ?? undefined,
      inp: coreWebVitals.inpMs ?? report.combinedLabMetrics.inpMs ?? undefined,
      speedScore:
        typeof performanceScore === "number"
          ? Math.round(performanceScore * 100)
          : undefined,
    },
    behavior: {},
    metadata: {
      source: "pagespeed",
      lastSyncedAt: syncedAt,
      dataQualityScore: 0,
    },
  };
}
