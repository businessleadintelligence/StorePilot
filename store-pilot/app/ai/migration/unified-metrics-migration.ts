import type {
  CombinedStoreMetrics,
  NormalizedBehaviorMetrics,
  NormalizedConversionMetrics,
  NormalizedPerformanceMetrics,
  NormalizedSeoMetrics,
  NormalizedTrafficMetrics,
  UnifiedStoreMetrics,
} from "../../connectors/normalization/normalized-metrics";

export const INSUFFICIENT_DATA = "insufficient_data" as const;

export type MigrationDataStatus = "available" | typeof INSUFFICIENT_DATA;

export type MigrationMetricResult<T> = {
  status: MigrationDataStatus;
  value: T | null;
};

export type UnifiedConnectorAvailability = {
  ga4: boolean;
  gsc: boolean;
  pagespeed: boolean;
  clarity: boolean;
};

export type LegacyConnectorFieldMap = {
  traffic: MigrationMetricResult<NormalizedTrafficMetrics>;
  revenue: MigrationMetricResult<NormalizedConversionMetrics>;
  seo: MigrationMetricResult<NormalizedSeoMetrics>;
  performance: MigrationMetricResult<NormalizedPerformanceMetrics>;
  behavior: MigrationMetricResult<NormalizedBehaviorMetrics>;
};

export type MigratedSeoConnectorSnapshot = {
  searchQueriesProxy: number;
  averageCtrProxy: number;
  averagePositionProxy: number;
  impressionsProxy: number;
  indexedPagesProxy: number;
  coverageIssues: number;
  lcpScore: number;
  clsScore: number;
  inpScore: number;
  pageSpeedPerformance: number;
  pageSpeedAccessibility: number;
  pageSpeedSeo: number;
  dataStatus: MigrationDataStatus;
};

const EMPTY_TRAFFIC: NormalizedTrafficMetrics = { sessions: 0, users: 0 };
const EMPTY_CONVERSION: NormalizedConversionMetrics = { rate: 0, revenue: 0, aov: 0 };
const EMPTY_SEO: NormalizedSeoMetrics = { clicks: 0, impressions: 0, ctr: 0, averagePosition: 0 };
const EMPTY_PERFORMANCE: NormalizedPerformanceMetrics = {};
const EMPTY_BEHAVIOR: NormalizedBehaviorMetrics = {};

export function createEmptyUnifiedStoreMetrics(
  referenceTime = new Date().toISOString(),
): UnifiedStoreMetrics {
  const emptyCombined: CombinedStoreMetrics = {
    traffic: { ...EMPTY_TRAFFIC },
    conversion: { ...EMPTY_CONVERSION },
    seo: { ...EMPTY_SEO },
    performance: { ...EMPTY_PERFORMANCE },
    behavior: { ...EMPTY_BEHAVIOR },
  };

  return {
    combined: emptyCombined,
    dataQuality: {
      score: 0,
      completenessScore: 0,
      freshnessScore: 0,
      reliabilityScore: 0,
      missingConnectors: ["ga4", "gsc", "pagespeed", "clarity"],
      staleConnectors: [],
    },
    lastSyncAt: referenceTime,
  };
}

export function getConnectorAvailability(unified: UnifiedStoreMetrics): UnifiedConnectorAvailability {
  return {
    ga4: Boolean(unified.ga4?.metadata.lastSyncedAt),
    gsc: Boolean(unified.gsc?.metadata.lastSyncedAt),
    pagespeed: Boolean(unified.pagespeed?.metadata.lastSyncedAt),
    clarity: Boolean(unified.clarity?.metadata.lastSyncedAt),
  };
}

function available<T>(value: T): MigrationMetricResult<T> {
  return { status: "available", value };
}

function insufficient<T>(): MigrationMetricResult<T> {
  return { status: INSUFFICIENT_DATA, value: null };
}

function readTrafficMetrics(metrics: NormalizedTrafficMetrics | undefined): MigrationMetricResult<NormalizedTrafficMetrics> {
  if (!metrics || (metrics.sessions <= 0 && metrics.users <= 0 && !metrics.channels)) {
    return insufficient();
  }
  return available(metrics);
}

function readConversionMetrics(
  metrics: NormalizedConversionMetrics | undefined,
): MigrationMetricResult<NormalizedConversionMetrics> {
  if (!metrics || (metrics.revenue <= 0 && metrics.rate <= 0 && metrics.aov <= 0)) {
    return insufficient();
  }
  return available(metrics);
}

function readSeoMetrics(metrics: NormalizedSeoMetrics | undefined): MigrationMetricResult<NormalizedSeoMetrics> {
  if (!metrics || (metrics.impressions <= 0 && metrics.clicks <= 0)) {
    return insufficient();
  }
  return available(metrics);
}

function readPerformanceMetrics(
  metrics: NormalizedPerformanceMetrics | undefined,
): MigrationMetricResult<NormalizedPerformanceMetrics> {
  if (
    !metrics ||
    (metrics.speedScore === undefined &&
      metrics.lcp === undefined &&
      metrics.cls === undefined &&
      metrics.inp === undefined)
  ) {
    return insufficient();
  }
  return available(metrics);
}

function readBehaviorMetrics(
  metrics: NormalizedBehaviorMetrics | undefined,
): MigrationMetricResult<NormalizedBehaviorMetrics> {
  if (
    !metrics ||
    (metrics.rageClicks === undefined &&
      metrics.scrollDepth === undefined &&
      !metrics.topLandingPages?.length &&
      !metrics.exitPages?.length)
  ) {
    return insufficient();
  }
  return available(metrics);
}

export function getTrafficMetrics(unified: UnifiedStoreMetrics): MigrationMetricResult<NormalizedTrafficMetrics> {
  const fromGa4 = readTrafficMetrics(unified.ga4?.traffic);
  if (fromGa4.status === "available") return fromGa4;

  const combined = unified.combined.traffic;
  if (combined.sessions > 0 || combined.users > 0) {
    return available(combined);
  }

  return insufficient();
}

export function getRevenueMetrics(
  unified: UnifiedStoreMetrics,
): MigrationMetricResult<NormalizedConversionMetrics> {
  const fromGa4 = readConversionMetrics(unified.ga4?.conversion);
  if (fromGa4.status === "available") return fromGa4;

  const combined = unified.combined.conversion;
  if (combined.revenue > 0 || combined.rate > 0 || combined.aov > 0) {
    return available(combined);
  }

  return insufficient();
}

export function getSeoMetrics(unified: UnifiedStoreMetrics): MigrationMetricResult<NormalizedSeoMetrics> {
  const fromGsc = readSeoMetrics(unified.gsc?.seo);
  if (fromGsc.status === "available") return fromGsc;

  return readSeoMetrics(unified.combined.seo);
}

export function getPerformanceMetrics(
  unified: UnifiedStoreMetrics,
): MigrationMetricResult<NormalizedPerformanceMetrics> {
  const fromPageSpeed = readPerformanceMetrics(unified.pagespeed?.performance);
  if (fromPageSpeed.status === "available") return fromPageSpeed;

  return readPerformanceMetrics(unified.combined.performance);
}

export function getBehaviorMetrics(
  unified: UnifiedStoreMetrics,
): MigrationMetricResult<NormalizedBehaviorMetrics> {
  const fromClarity = readBehaviorMetrics(unified.clarity?.behavior);
  if (fromClarity.status === "available") return fromClarity;

  return readBehaviorMetrics(unified.combined.behavior);
}

export function mapLegacyConnectorFields(unified: UnifiedStoreMetrics): LegacyConnectorFieldMap {
  return {
    traffic: getTrafficMetrics(unified),
    revenue: getRevenueMetrics(unified),
    seo: getSeoMetrics(unified),
    performance: getPerformanceMetrics(unified),
    behavior: getBehaviorMetrics(unified),
  };
}

function scoreFromCoreWebVital(value: number | undefined, goodThreshold: number, poorThreshold: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  if (value <= goodThreshold) return 92;
  if (value >= poorThreshold) return 45;
  return Math.round(92 - ((value - goodThreshold) / (poorThreshold - goodThreshold)) * 47);
}

function buildCoreWebVitalScores(performance: NormalizedPerformanceMetrics): {
  lcpScore: number;
  clsScore: number;
  inpScore: number;
} {
  if (performance.speedScore !== undefined) {
    const speedScore = performance.speedScore;
    return {
      lcpScore: speedScore,
      clsScore: Math.max(40, speedScore - 4),
      inpScore: Math.max(38, speedScore - 6),
    };
  }

  return {
    lcpScore: scoreFromCoreWebVital(performance.lcp, 2500, 4000),
    clsScore: scoreFromCoreWebVital(performance.cls, 0.1, 0.25),
    inpScore: scoreFromCoreWebVital(performance.inp, 200, 500),
  };
}

export function buildSeoConnectorSnapshotFromUnified(
  unified: UnifiedStoreMetrics,
  catalogFallback?: {
    indexedPagesProxy: number;
    coverageIssues: number;
  },
): MigratedSeoConnectorSnapshot {
  const seo = getSeoMetrics(unified);
  const performance = getPerformanceMetrics(unified);
  const traffic = getTrafficMetrics(unified);

  if (seo.status === INSUFFICIENT_DATA && performance.status === INSUFFICIENT_DATA) {
    return {
      searchQueriesProxy: 0,
      averageCtrProxy: 0,
      averagePositionProxy: 0,
      impressionsProxy: 0,
      indexedPagesProxy: catalogFallback?.indexedPagesProxy ?? 0,
      coverageIssues: catalogFallback?.coverageIssues ?? 0,
      lcpScore: 0,
      clsScore: 0,
      inpScore: 0,
      pageSpeedPerformance: 0,
      pageSpeedAccessibility: 0,
      pageSpeedSeo: 0,
      dataStatus: INSUFFICIENT_DATA,
    };
  }

  const seoValue = seo.value ?? EMPTY_SEO;
  const performanceValue = performance.value ?? EMPTY_PERFORMANCE;
  const vitalScores = buildCoreWebVitalScores(performanceValue);
  const speedScore = performanceValue.speedScore ?? vitalScores.lcpScore;

  return {
    searchQueriesProxy:
      traffic.status === "available" ? Math.max(0, Math.round(traffic.value!.sessions * 0.35)) : 0,
    averageCtrProxy: seoValue.ctr,
    averagePositionProxy: seoValue.averagePosition,
    impressionsProxy: seoValue.impressions,
    indexedPagesProxy: catalogFallback?.indexedPagesProxy ?? 0,
    coverageIssues: catalogFallback?.coverageIssues ?? 0,
    lcpScore: vitalScores.lcpScore,
    clsScore: vitalScores.clsScore,
    inpScore: vitalScores.inpScore,
    pageSpeedPerformance: speedScore,
    pageSpeedAccessibility: Math.max(40, speedScore - 6),
    pageSpeedSeo: Math.max(42, speedScore - 8),
    dataStatus: "available",
  };
}

export function createMockUnifiedStoreMetricsForFacts(
  overrides: Partial<UnifiedStoreMetrics> = {},
): UnifiedStoreMetrics {
  const base = createEmptyUnifiedStoreMetrics();
  const syncedAt = new Date().toISOString();

  return {
    ...base,
    ...overrides,
    ga4: overrides.ga4 ?? {
      traffic: { sessions: 1200, users: 980, bounceRate: 0.42, channels: { organic: 420 } },
      conversion: { rate: 0.028, revenue: 15000, aov: 62.5 },
      seo: { ...EMPTY_SEO },
      performance: { ...EMPTY_PERFORMANCE },
      behavior: { ...EMPTY_BEHAVIOR },
      metadata: { source: "ga4", lastSyncedAt: syncedAt, dataQualityScore: 82 },
    },
    gsc: overrides.gsc ?? {
      traffic: { ...EMPTY_TRAFFIC },
      conversion: { ...EMPTY_CONVERSION },
      seo: { clicks: 320, impressions: 6400, ctr: 0.05, averagePosition: 11.2 },
      performance: { ...EMPTY_PERFORMANCE },
      behavior: { ...EMPTY_BEHAVIOR },
      metadata: { source: "gsc", lastSyncedAt: syncedAt, dataQualityScore: 80 },
    },
    pagespeed: overrides.pagespeed ?? {
      traffic: { ...EMPTY_TRAFFIC },
      conversion: { ...EMPTY_CONVERSION },
      seo: { ...EMPTY_SEO },
      performance: { lcp: 2400, cls: 0.08, inp: 180, speedScore: 82 },
      behavior: { ...EMPTY_BEHAVIOR },
      metadata: { source: "pagespeed", lastSyncedAt: syncedAt, dataQualityScore: 78 },
    },
    clarity: overrides.clarity ?? {
      traffic: { ...EMPTY_TRAFFIC },
      conversion: { ...EMPTY_CONVERSION },
      seo: { ...EMPTY_SEO },
      performance: { ...EMPTY_PERFORMANCE },
      behavior: {
        rageClicks: 18,
        scrollDepth: 0.62,
        topLandingPages: ["/", "/collections/all"],
        exitPages: ["/cart"],
      },
      metadata: { source: "clarity", lastSyncedAt: syncedAt, dataQualityScore: 76 },
    },
    combined: overrides.combined ?? base.combined,
    dataQuality: overrides.dataQuality ?? {
      score: 78,
      completenessScore: 100,
      freshnessScore: 85,
      reliabilityScore: 80,
      missingConnectors: [],
      staleConnectors: [],
    },
    lastSyncAt: overrides.lastSyncAt ?? syncedAt,
  };
}
