import { getCachedUnifiedMetrics } from "../../connectors/core/connector-cache";
import type { UnifiedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import { createEmptyUnifiedStoreMetrics } from "./unified-metrics-migration";

export async function loadUnifiedStoreMetricsForFacts(
  storeId: string,
  referenceTime = Date.now(),
): Promise<UnifiedStoreMetrics> {
  if (!storeId.trim()) {
    return createEmptyUnifiedStoreMetrics();
  }

  return getCachedUnifiedMetrics(storeId, referenceTime) ?? createEmptyUnifiedStoreMetrics();
}
