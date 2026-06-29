import { buildSubsystemHealth } from "./production-checks";
import { aggregateHealthLevel, aggregateHealthScore } from "./production-status";
import type {
  ProductionDataQualityExplanation,
  ProductionHealthLevel,
  ProductionHealthSnapshot,
  ProductionSubsystemHealth,
} from "./production-types";

export function buildDataQualitySubsystem(
  explanation: ProductionDataQualityExplanation,
): ProductionSubsystemHealth {
  const level: ProductionHealthLevel =
    explanation.score >= 85
      ? "healthy"
      : explanation.score >= 70
        ? "warning"
        : explanation.score >= 50
          ? "critical"
          : "offline";

  return buildSubsystemHealth({
    id: "data_quality",
    label: "Data Quality",
    level,
    lastError:
      explanation.missingConnectors.length > 0
        ? `Missing connectors: ${explanation.missingConnectors.join(", ")}`
        : explanation.staleConnectors.length > 0
          ? `Stale connectors: ${explanation.staleConnectors.join(", ")}`
          : null,
    recoverySuggestion:
      explanation.score < 70
        ? "Reconnect missing integrations and retry sync from Settings"
        : null,
    details: {
      score: explanation.score,
      completeness: explanation.completeness,
      freshness: explanation.freshness,
      reliability: explanation.reliability,
      missingConnectors: explanation.missingConnectors.length,
      staleConnectors: explanation.staleConnectors.length,
    },
  });
}

export function summarizeProductionHealth(subsystems: ProductionSubsystemHealth[]): {
  overallHealthScore: number;
  overallLevel: ProductionHealthLevel;
} {
  return {
    overallHealthScore: aggregateHealthScore(subsystems.map((item) => item.healthScore)),
    overallLevel: aggregateHealthLevel(subsystems.map((item) => item.level)),
  };
}

export function isProductionSnapshotStale(
  snapshot: ProductionHealthSnapshot,
  maxAgeMs = 60_000,
  reference = Date.now(),
): boolean {
  const computedAt = Date.parse(snapshot.computedAt);
  if (!Number.isFinite(computedAt)) return true;
  return reference - computedAt > maxAgeMs;
}
