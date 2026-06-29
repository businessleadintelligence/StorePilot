import type { ProductionHealthLevel, ProductionSubsystemHealth } from "./production-types";
import { scoreFromLevel } from "./production-status";

export function buildSubsystemHealth(input: {
  id: ProductionSubsystemHealth["id"];
  label: string;
  level: ProductionHealthLevel;
  lastSync?: string | null;
  averageLatencyMs?: number | null;
  failureCount?: number;
  retryCount?: number;
  lastError?: string | null;
  recoverySuggestion?: string | null;
  nextRetry?: string | null;
  details?: Record<string, string | number | boolean | null>;
}): ProductionSubsystemHealth {
  return {
    id: input.id,
    label: input.label,
    level: input.level,
    healthScore: scoreFromLevel(input.level),
    lastSync: input.lastSync ?? null,
    averageLatencyMs: input.averageLatencyMs ?? null,
    failureCount: input.failureCount ?? 0,
    retryCount: input.retryCount ?? 0,
    lastError: input.lastError ?? null,
    recoverySuggestion: input.recoverySuggestion ?? null,
    nextRetry: input.nextRetry ?? null,
    details: input.details ?? {},
  };
}

export function levelFromBoolean(connected: boolean, configured = true): ProductionHealthLevel {
  if (!configured) return "unknown";
  return connected ? "healthy" : "offline";
}

export function levelFromSyncTimestamp(
  lastSync: string | null,
  connected: boolean,
  staleHours = 24,
): ProductionHealthLevel {
  if (!connected) return "offline";
  if (!lastSync) return "warning";
  const ageMs = Date.now() - Date.parse(lastSync);
  if (!Number.isFinite(ageMs)) return "unknown";
  if (ageMs > staleHours * 60 * 60 * 1000) return "warning";
  return "healthy";
}

export function levelFromFailureCount(failures: number, criticalThreshold = 5): ProductionHealthLevel {
  if (failures <= 0) return "healthy";
  if (failures < criticalThreshold) return "warning";
  return "critical";
}
