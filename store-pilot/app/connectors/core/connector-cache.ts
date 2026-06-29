import type { UnifiedStoreMetrics } from "../normalization/normalized-metrics";

export type ConnectorCacheEntry = {
  storeId: string;
  metrics: UnifiedStoreMetrics;
  cachedAt: string;
  expiresAt: string;
};

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 15;

const cache = new Map<string, ConnectorCacheEntry>();

export function getCachedUnifiedMetrics(storeId: string, referenceTime = Date.now()): UnifiedStoreMetrics | null {
  const entry = cache.get(storeId);
  if (!entry) return null;
  if (Date.parse(entry.expiresAt) <= referenceTime) {
    cache.delete(storeId);
    return null;
  }
  return entry.metrics;
}

export function setCachedUnifiedMetrics(
  storeId: string,
  metrics: UnifiedStoreMetrics,
  ttlMs = DEFAULT_CACHE_TTL_MS,
  referenceTime = Date.now(),
): ConnectorCacheEntry {
  const cachedAt = new Date(referenceTime).toISOString();
  const entry: ConnectorCacheEntry = {
    storeId,
    metrics,
    cachedAt,
    expiresAt: new Date(referenceTime + ttlMs).toISOString(),
  };
  cache.set(storeId, entry);
  return entry;
}

export function clearConnectorCache(storeId?: string): void {
  if (storeId) {
    cache.delete(storeId);
    return;
  }
  cache.clear();
}

export function getConnectorCacheEntry(storeId: string): ConnectorCacheEntry | null {
  return cache.get(storeId) ?? null;
}

export function getConnectorCacheSize(): number {
  return cache.size;
}

export { DEFAULT_CACHE_TTL_MS };
