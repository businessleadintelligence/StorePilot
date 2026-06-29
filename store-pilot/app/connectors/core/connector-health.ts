export type ConnectorHealthStatus = "healthy" | "degraded" | "failed";

export type ConnectorHealth = {
  status: ConnectorHealthStatus;
  lastSuccessSync: string | null;
  lastAttemptAt: string | null;
  latencyMs: number;
  errorRate: number;
  dataFreshnessMs: number | null;
  consecutiveFailures: number;
  lastError: string | null;
};

export type ConnectorHealthSnapshot = ConnectorHealth & {
  connectorId: string;
};

const HEALTHY_ERROR_RATE_THRESHOLD = 0.2;
const DEGRADED_ERROR_RATE_THRESHOLD = 0.5;
const STALE_DATA_MS = 1000 * 60 * 60 * 24;

export function createInitialConnectorHealth(now = new Date().toISOString()): ConnectorHealth {
  return {
    status: "degraded",
    lastSuccessSync: null,
    lastAttemptAt: now,
    latencyMs: 0,
    errorRate: 0,
    dataFreshnessMs: null,
    consecutiveFailures: 0,
    lastError: null,
  };
}

export function recordConnectorSuccess(
  health: ConnectorHealth,
  input: { latencyMs: number; syncedAt?: string },
): ConnectorHealth {
  const syncedAt = input.syncedAt ?? new Date().toISOString();
  const nextErrorRate = Math.max(0, health.errorRate * 0.8);

  return {
    ...health,
    status: "healthy",
    lastSuccessSync: syncedAt,
    lastAttemptAt: syncedAt,
    latencyMs: input.latencyMs,
    errorRate: nextErrorRate,
    dataFreshnessMs: 0,
    consecutiveFailures: 0,
    lastError: null,
  };
}

export function recordConnectorFailure(
  health: ConnectorHealth,
  input: { error: string; attemptedAt?: string },
): ConnectorHealth {
  const attemptedAt = input.attemptedAt ?? new Date().toISOString();
  const attempts = health.consecutiveFailures + 1;
  const nextErrorRate = Math.min(1, (health.errorRate * attempts + 1) / (attempts + 1));

  return {
    ...health,
    status: deriveHealthStatus(nextErrorRate, health.lastSuccessSync, attemptedAt),
    lastAttemptAt: attemptedAt,
    errorRate: nextErrorRate,
    consecutiveFailures: attempts,
    lastError: input.error,
    dataFreshnessMs: health.lastSuccessSync
      ? Math.max(0, Date.parse(attemptedAt) - Date.parse(health.lastSuccessSync))
      : null,
  };
}

export function deriveHealthStatus(
  errorRate: number,
  lastSuccessSync: string | null,
  referenceTime = new Date().toISOString(),
): ConnectorHealthStatus {
  if (errorRate >= DEGRADED_ERROR_RATE_THRESHOLD || !lastSuccessSync) {
    return "failed";
  }

  const freshnessMs = Date.parse(referenceTime) - Date.parse(lastSuccessSync);
  if (errorRate >= HEALTHY_ERROR_RATE_THRESHOLD || freshnessMs > STALE_DATA_MS) {
    return "degraded";
  }

  return "healthy";
}

export function refreshConnectorHealthStatus(
  health: ConnectorHealth,
  referenceTime = new Date().toISOString(),
): ConnectorHealth {
  return {
    ...health,
    status: deriveHealthStatus(health.errorRate, health.lastSuccessSync, referenceTime),
    dataFreshnessMs: health.lastSuccessSync
      ? Math.max(0, Date.parse(referenceTime) - Date.parse(health.lastSuccessSync))
      : null,
  };
}

export function isConnectorStale(
  health: ConnectorHealth,
  staleThresholdMs = STALE_DATA_MS,
  referenceTime = Date.now(),
): boolean {
  if (!health.lastSuccessSync) return true;
  return referenceTime - Date.parse(health.lastSuccessSync) > staleThresholdMs;
}
