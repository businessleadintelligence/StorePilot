import type {
  CombinedStoreMetrics,
  ConnectorSource,
  NormalizedBehaviorMetrics,
  NormalizedConversionMetrics,
  NormalizedPerformanceMetrics,
  NormalizedSeoMetrics,
  NormalizedStoreMetrics,
  NormalizedTrafficMetrics,
  UnifiedStoreMetrics,
} from "./normalized-metrics";

function averageDefined(values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (defined.length === 0) return undefined;
  return defined.reduce((sum, value) => sum + value, 0) / defined.length;
}

function sumDefined(values: Array<number | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
}

function mergeChannelMaps(metrics: NormalizedStoreMetrics[]): Record<string, number> | undefined {
  const merged: Record<string, number> = {};
  let hasChannels = false;

  for (const metric of metrics) {
    if (!metric.traffic.channels) continue;
    hasChannels = true;
    for (const [channel, count] of Object.entries(metric.traffic.channels)) {
      merged[channel] = (merged[channel] ?? 0) + count;
    }
  }

  return hasChannels ? merged : undefined;
}

function mergeStringLists(
  metrics: NormalizedStoreMetrics[],
  selector: (metric: NormalizedStoreMetrics) => string[] | undefined,
  limit = 5,
): string[] | undefined {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const metric of metrics) {
    for (const value of selector(metric) ?? []) {
      if (seen.has(value)) continue;
      seen.add(value);
      merged.push(value);
      if (merged.length >= limit) return merged;
    }
  }

  return merged.length > 0 ? merged : undefined;
}

export function mergeTrafficMetrics(metrics: NormalizedStoreMetrics[]): NormalizedTrafficMetrics {
  return {
    sessions: sumDefined(metrics.map((metric) => metric.traffic.sessions)),
    users: sumDefined(metrics.map((metric) => metric.traffic.users)),
    bounceRate: averageDefined(metrics.map((metric) => metric.traffic.bounceRate)),
    channels: mergeChannelMaps(metrics),
  };
}

export function mergeConversionMetrics(metrics: NormalizedStoreMetrics[]): NormalizedConversionMetrics {
  const revenue = sumDefined(metrics.map((metric) => metric.conversion.revenue));
  const totalSessions = sumDefined(metrics.map((metric) => metric.traffic.sessions));
  const weightedRate = metrics.reduce((sum, metric) => {
    const weight = metric.traffic.sessions;
    return sum + metric.conversion.rate * weight;
  }, 0);
  const rate = totalSessions > 0 ? weightedRate / totalSessions : averageDefined(metrics.map((metric) => metric.conversion.rate)) ?? 0;
  const aov = revenue > 0
    ? revenue / Math.max(1, sumDefined(metrics.map((metric) => (metric.conversion.aov > 0 ? metric.conversion.revenue / metric.conversion.aov : 0))))
    : averageDefined(metrics.map((metric) => metric.conversion.aov)) ?? 0;

  return {
    rate: Number(rate.toFixed(4)),
    revenue: Number(revenue.toFixed(2)),
    aov: Number(aov.toFixed(2)),
  };
}

export function mergeSeoMetrics(metrics: NormalizedStoreMetrics[]): NormalizedSeoMetrics {
  const clicks = sumDefined(metrics.map((metric) => metric.seo.clicks));
  const impressions = sumDefined(metrics.map((metric) => metric.seo.impressions));
  const ctr = impressions > 0 ? clicks / impressions : averageDefined(metrics.map((metric) => metric.seo.ctr)) ?? 0;

  return {
    clicks,
    impressions,
    ctr: Number(ctr.toFixed(4)),
    averagePosition: averageDefined(metrics.map((metric) => metric.seo.averagePosition)) ?? 0,
  };
}

export function mergePerformanceMetrics(metrics: NormalizedStoreMetrics[]): NormalizedPerformanceMetrics {
  const performanceSources = metrics.filter((metric) =>
    metric.metadata.source === "pagespeed" || metric.performance.speedScore !== undefined,
  );

  const sourceMetrics = performanceSources.length > 0 ? performanceSources : metrics;

  return {
    lcp: averageDefined(sourceMetrics.map((metric) => metric.performance.lcp)),
    cls: averageDefined(sourceMetrics.map((metric) => metric.performance.cls)),
    inp: averageDefined(sourceMetrics.map((metric) => metric.performance.inp)),
    speedScore: averageDefined(sourceMetrics.map((metric) => metric.performance.speedScore)),
  };
}

export function mergeBehaviorMetrics(metrics: NormalizedStoreMetrics[]): NormalizedBehaviorMetrics {
  return {
    topLandingPages: mergeStringLists(metrics, (metric) => metric.behavior.topLandingPages),
    exitPages: mergeStringLists(metrics, (metric) => metric.behavior.exitPages),
    rageClicks: sumDefined(metrics.map((metric) => metric.behavior.rageClicks)),
    scrollDepth: averageDefined(metrics.map((metric) => metric.behavior.scrollDepth)),
  };
}

export function mergeCombinedMetrics(metrics: NormalizedStoreMetrics[]): CombinedStoreMetrics {
  if (metrics.length === 0) {
    return {
      traffic: { sessions: 0, users: 0 },
      conversion: { rate: 0, revenue: 0, aov: 0 },
      seo: { clicks: 0, impressions: 0, ctr: 0, averagePosition: 0 },
      performance: {},
      behavior: {},
    };
  }

  return {
    traffic: mergeTrafficMetrics(metrics),
    conversion: mergeConversionMetrics(metrics),
    seo: mergeSeoMetrics(metrics),
    performance: mergePerformanceMetrics(metrics),
    behavior: mergeBehaviorMetrics(metrics),
  };
}

export function assignConnectorSlot(
  unified: UnifiedStoreMetrics,
  source: ConnectorSource,
  metrics: NormalizedStoreMetrics,
): UnifiedStoreMetrics {
  switch (source) {
    case "ga4":
      return { ...unified, ga4: metrics };
    case "gsc":
      return { ...unified, gsc: metrics };
    case "pagespeed":
      return { ...unified, pagespeed: metrics };
    case "clarity":
      return { ...unified, clarity: metrics };
    default:
      return unified;
  }
}

export function buildUnifiedStoreMetrics(input: {
  connectors: Partial<Record<ConnectorSource, NormalizedStoreMetrics>>;
  lastSyncAt: string;
  dataQuality: UnifiedStoreMetrics["dataQuality"];
}): UnifiedStoreMetrics {
  const present = Object.values(input.connectors).filter(
    (metric): metric is NormalizedStoreMetrics => metric !== undefined,
  );

  const unified: UnifiedStoreMetrics = {
    combined: mergeCombinedMetrics(present),
    dataQuality: input.dataQuality,
    lastSyncAt: input.lastSyncAt,
  };

  if (input.connectors.ga4) {
    unified.ga4 = input.connectors.ga4;
  }
  if (input.connectors.gsc) {
    unified.gsc = input.connectors.gsc;
  }
  if (input.connectors.pagespeed) {
    unified.pagespeed = input.connectors.pagespeed;
  }
  if (input.connectors.clarity) {
    unified.clarity = input.connectors.clarity;
  }

  return unified;
}

export function validateNormalizedStoreMetrics(data: NormalizedStoreMetrics): boolean {
  if (!data.metadata?.source || !data.metadata.lastSyncedAt) return false;
  if (typeof data.metadata.dataQualityScore !== "number") return false;
  if (!Number.isFinite(data.traffic.sessions) || !Number.isFinite(data.traffic.users)) return false;
  if (!Number.isFinite(data.conversion.rate) || !Number.isFinite(data.conversion.revenue) || !Number.isFinite(data.conversion.aov)) {
    return false;
  }
  if (
    !Number.isFinite(data.seo.clicks) ||
    !Number.isFinite(data.seo.impressions) ||
    !Number.isFinite(data.seo.ctr) ||
    !Number.isFinite(data.seo.averagePosition)
  ) {
    return false;
  }

  return true;
}
