import { buildUnifiedStoreMetrics } from "../normalization/metrics-transformer";
import {
  clearConnectorCache,
  DEFAULT_CACHE_TTL_MS,
  getCachedUnifiedMetrics,
  setCachedUnifiedMetrics,
} from "./connector-cache";
import { computeUnifiedDataQuality } from "./data-quality";
import {
  collectSuccessfulMetrics,
  getStoreConnectorHealth,
  listRegisteredConnectors,
  runAllConnectors,
} from "./connector.registry";
import type {
  ConnectorContext,
  ConnectorId,
  ConnectorRunResult,
  ConnectorSyncOptions,
  ConnectorSyncResult,
} from "./connector.types";
import { ALL_CONNECTOR_IDS } from "./connector.types";
import { sleep } from "./connector-utils";

const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 100;

function resolveConnectorIds(options?: ConnectorSyncOptions): ConnectorId[] {
  if (options?.connectorIds && options.connectorIds.length > 0) {
    return options.connectorIds;
  }
  return listRegisteredConnectors();
}

async function retryFailedConnectors(input: {
  context: ConnectorContext;
  runs: ConnectorRunResult[];
  retryAttempts: number;
  retryDelayMs: number;
}): Promise<ConnectorRunResult[]> {
  const merged = new Map<ConnectorId, ConnectorRunResult>(
    input.runs.map((run) => [run.connectorId, run]),
  );

  for (let attempt = 0; attempt < input.retryAttempts; attempt += 1) {
    const failedIds = [...merged.values()]
      .filter((run) => run.status === "failed")
      .map((run) => run.connectorId);

    if (failedIds.length === 0) break;

    if (input.retryDelayMs > 0) {
      await sleep(input.retryDelayMs);
    }

    const retryRuns = await runAllConnectors({
      context: input.context,
      connectorIds: failedIds,
    });

    for (const run of retryRuns) {
      merged.set(run.connectorId, run);
    }
  }

  return [...merged.values()];
}

export async function syncStoreConnectors(
  context: ConnectorContext,
  options: ConnectorSyncOptions = {},
): Promise<ConnectorSyncResult> {
  const connectorIds = resolveConnectorIds(options);
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const useCache = options.useCache ?? true;
  const forceRefresh = options.forceRefresh ?? false;

  if (useCache && !forceRefresh) {
    const cached = getCachedUnifiedMetrics(context.storeId);
    if (cached) {
      return {
        storeId: context.storeId,
        metrics: cached,
        runs: [],
        fromCache: true,
      };
    }
  }

  const initialRuns = await runAllConnectors({ context, connectorIds });
  const runs = await retryFailedConnectors({
    context,
    runs: initialRuns,
    retryAttempts: options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
  });

  const connectors = collectSuccessfulMetrics(runs);
  const presentConnectorIds = Object.keys(connectors) as ConnectorId[];
  const lastSyncAt = new Date().toISOString();
  const dataQuality = computeUnifiedDataQuality({
    presentConnectorIds,
    expectedConnectorIds: connectorIds.length > 0 ? connectorIds : ALL_CONNECTOR_IDS,
    connectorHealth: getStoreConnectorHealth(context.storeId),
  });

  const metrics = buildUnifiedStoreMetrics({
    connectors,
    lastSyncAt,
    dataQuality,
  });

  if (useCache) {
    setCachedUnifiedMetrics(context.storeId, metrics, cacheTtlMs);
  }

  return {
    storeId: context.storeId,
    metrics,
    runs,
    fromCache: false,
  };
}

export function invalidateStoreConnectorCache(storeId: string): void {
  clearConnectorCache(storeId);
}

export { DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_DELAY_MS };
