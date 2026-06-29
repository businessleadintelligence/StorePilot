export const CONNECTOR_SOURCES = ["ga4", "gsc", "pagespeed", "clarity"] as const;

export type ConnectorSource = (typeof CONNECTOR_SOURCES)[number];

export type NormalizedTrafficMetrics = {
  sessions: number;
  users: number;
  bounceRate?: number;
  channels?: Record<string, number>;
};

export type NormalizedConversionMetrics = {
  rate: number;
  revenue: number;
  aov: number;
};

export type NormalizedSeoMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
};

export type NormalizedPerformanceMetrics = {
  lcp?: number;
  cls?: number;
  inp?: number;
  speedScore?: number;
};

export type NormalizedBehaviorMetrics = {
  topLandingPages?: string[];
  exitPages?: string[];
  rageClicks?: number;
  scrollDepth?: number;
};

export type NormalizedStoreMetrics = {
  traffic: NormalizedTrafficMetrics;
  conversion: NormalizedConversionMetrics;
  seo: NormalizedSeoMetrics;
  performance: NormalizedPerformanceMetrics;
  behavior: NormalizedBehaviorMetrics;
  metadata: {
    source: ConnectorSource;
    lastSyncedAt: string;
    dataQualityScore: number;
  };
};

export type CombinedStoreMetrics = {
  traffic: NormalizedTrafficMetrics;
  conversion: NormalizedConversionMetrics;
  seo: NormalizedSeoMetrics;
  performance: NormalizedPerformanceMetrics;
  behavior: NormalizedBehaviorMetrics;
};

export type UnifiedDataQuality = {
  score: number;
  completenessScore: number;
  freshnessScore: number;
  reliabilityScore: number;
  missingConnectors: string[];
  staleConnectors: string[];
};

export type UnifiedStoreMetrics = {
  ga4?: NormalizedStoreMetrics;
  gsc?: NormalizedStoreMetrics;
  pagespeed?: NormalizedStoreMetrics;
  clarity?: NormalizedStoreMetrics;
  combined: CombinedStoreMetrics;
  dataQuality: UnifiedDataQuality;
  lastSyncAt: string;
};
