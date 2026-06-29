import type { NormalizedStoreMetrics, UnifiedDataQuality } from "../normalization/normalized-metrics";
import type { ConnectorHealth } from "./connector-health";
import { isConnectorStale } from "./connector-health";
import type { ConnectorId } from "./connector.types";
import { applyConnectorMissingPenalties } from "./data-quality-warnings";
import { ALL_CONNECTOR_IDS } from "./connector.types";

const COMPLETENESS_WEIGHT = 0.4;
const FRESHNESS_WEIGHT = 0.3;
const RELIABILITY_WEIGHT = 0.3;
const MISSING_CONNECTOR_PENALTY = 8;
const STALE_CONNECTOR_PENALTY = 5;

export function computeConnectorDataQualityScore(metrics: NormalizedStoreMetrics): number {
  const sections = [
    metrics.traffic.sessions >= 0,
    metrics.traffic.users >= 0,
    metrics.conversion.rate >= 0,
    metrics.conversion.revenue >= 0,
    metrics.conversion.aov >= 0,
    metrics.seo.clicks >= 0,
    metrics.seo.impressions >= 0,
    metrics.seo.ctr >= 0,
    metrics.seo.averagePosition >= 0,
    Boolean(metrics.metadata.lastSyncedAt),
  ];

  const optionalSignals = [
    metrics.traffic.bounceRate !== undefined,
    metrics.traffic.channels !== undefined,
    metrics.performance.speedScore !== undefined,
    metrics.performance.lcp !== undefined,
    metrics.behavior.topLandingPages !== undefined,
    metrics.behavior.scrollDepth !== undefined,
  ];

  const requiredScore = sections.filter(Boolean).length / sections.length;
  const optionalScore = optionalSignals.filter(Boolean).length / optionalSignals.length;

  return Math.round(requiredScore * 70 + optionalScore * 30);
}

export function computeCompletenessScore(
  presentConnectorIds: ConnectorId[],
  expectedConnectorIds: ConnectorId[] = ALL_CONNECTOR_IDS,
): number {
  if (expectedConnectorIds.length === 0) return 100;
  const present = new Set(presentConnectorIds);
  const matched = expectedConnectorIds.filter((connectorId) => present.has(connectorId)).length;
  return Math.round((matched / expectedConnectorIds.length) * 100);
}

export function computeFreshnessScore(
  connectorHealth: Partial<Record<ConnectorId, ConnectorHealth>>,
  staleThresholdMs: number,
  referenceTime = Date.now(),
): number {
  const healthEntries = Object.values(connectorHealth).filter(
    (health): health is ConnectorHealth => health !== undefined,
  );

  if (healthEntries.length === 0) return 0;

  const freshnessRatios = healthEntries.map((health) => {
    if (!health.lastSuccessSync) return 0;
    const ageMs = Math.max(0, referenceTime - Date.parse(health.lastSuccessSync));
    if (ageMs >= staleThresholdMs) return 0;
    return 1 - ageMs / staleThresholdMs;
  });

  return Math.round(
    (freshnessRatios.reduce((sum, ratio) => sum + ratio, 0) / freshnessRatios.length) * 100,
  );
}

export function computeReliabilityScore(
  connectorHealth: Partial<Record<ConnectorId, ConnectorHealth>>,
): number {
  const healthEntries = Object.values(connectorHealth).filter(
    (health): health is ConnectorHealth => health !== undefined,
  );

  if (healthEntries.length === 0) return 0;

  const reliabilityRatios = healthEntries.map((health) => {
    if (health.status === "healthy") return 1;
    if (health.status === "degraded") return 0.6;
    return 0.2;
  });

  return Math.round(
    (reliabilityRatios.reduce((sum, ratio) => sum + ratio, 0) / reliabilityRatios.length) * 100,
  );
}

export function computeUnifiedDataQuality(input: {
  presentConnectorIds: ConnectorId[];
  expectedConnectorIds?: ConnectorId[];
  connectorHealth: Partial<Record<ConnectorId, ConnectorHealth>>;
  staleThresholdMs?: number;
  referenceTime?: number;
  googleAnalyticsSkipped?: boolean;
}): UnifiedDataQuality {
  const expectedConnectorIds = input.expectedConnectorIds ?? ALL_CONNECTOR_IDS;
  const staleThresholdMs = input.staleThresholdMs ?? 1000 * 60 * 60 * 24;
  const referenceTime = input.referenceTime ?? Date.now();
  const presentSet = new Set(input.presentConnectorIds);

  const missingConnectors = expectedConnectorIds.filter((connectorId) => !presentSet.has(connectorId));
  const staleConnectors = expectedConnectorIds.filter((connectorId) => {
    const health = input.connectorHealth[connectorId];
    return !health || isConnectorStale(health, staleThresholdMs, referenceTime);
  });

  const completenessScore = computeCompletenessScore(input.presentConnectorIds, expectedConnectorIds);
  const freshnessScore = computeFreshnessScore(input.connectorHealth, staleThresholdMs, referenceTime);
  const reliabilityScore = computeReliabilityScore(input.connectorHealth);

  const weightedBase =
    completenessScore * COMPLETENESS_WEIGHT +
    freshnessScore * FRESHNESS_WEIGHT +
    reliabilityScore * RELIABILITY_WEIGHT;

  const penalty =
    missingConnectors.length * MISSING_CONNECTOR_PENALTY +
    staleConnectors.length * STALE_CONNECTOR_PENALTY;

  const score = Math.max(
    0,
    Math.min(
      100,
      applyConnectorMissingPenalties(Math.round(weightedBase - penalty), [...presentSet]),
    ),
  );

  return {
    score,
    completenessScore,
    freshnessScore,
    reliabilityScore,
    missingConnectors,
    staleConnectors,
  };
}
