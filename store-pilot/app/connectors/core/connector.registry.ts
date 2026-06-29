import type { NormalizedStoreMetrics } from "../normalization/normalized-metrics";
import type { BaseConnector } from "./connector.interface";
import { ConnectorError } from "./connector-errors";
import {
  createInitialConnectorHealth,
  recordConnectorFailure,
  recordConnectorSuccess,
  refreshConnectorHealthStatus,
  type ConnectorHealth,
} from "./connector-health";
import type {
  ConnectorContext,
  ConnectorFactory,
  ConnectorId,
  ConnectorRegistryStatus,
  ConnectorRunResult,
} from "./connector.types";
import { ALL_CONNECTOR_IDS } from "./connector.types";

const registry = new Map<ConnectorId, ConnectorFactory>();
const healthByStore = new Map<string, Map<ConnectorId, ConnectorHealth>>();

function getStoreHealthMap(storeId: string): Map<ConnectorId, ConnectorHealth> {
  const existing = healthByStore.get(storeId);
  if (existing) return existing;

  const created = new Map<ConnectorId, ConnectorHealth>();
  healthByStore.set(storeId, created);
  return created;
}

export function registerConnector(connectorId: ConnectorId, factory: ConnectorFactory): void {
  registry.set(connectorId, factory);
}

export function unregisterConnector(connectorId: ConnectorId): void {
  registry.delete(connectorId);
}

export function getConnector(connectorId: ConnectorId, context: ConnectorContext): BaseConnector {
  const factory = registry.get(connectorId);
  if (!factory) {
    throw new ConnectorError({
      code: "connector_not_registered",
      message: `Connector not registered: ${connectorId}`,
      connectorId,
    });
  }

  return factory(context);
}

export function listRegisteredConnectors(): ConnectorId[] {
  return [...registry.keys()];
}

export function resetConnectorRegistry(): void {
  registry.clear();
  healthByStore.clear();
}

export function getConnectorHealthSnapshot(storeId: string, connectorId: ConnectorId): ConnectorHealth | null {
  const health = getStoreHealthMap(storeId).get(connectorId);
  return health ? refreshConnectorHealthStatus(health) : null;
}

export function getConnectorStatus(storeId: string): ConnectorRegistryStatus[] {
  const storeHealth = getStoreHealthMap(storeId);

  return ALL_CONNECTOR_IDS.map((connectorId) => ({
    connectorId,
    registered: registry.has(connectorId),
    health: refreshConnectorHealthStatus(
      storeHealth.get(connectorId) ??
        createInitialConnectorHealth(),
    ),
  }));
}

async function runConnectorOnce(connector: BaseConnector, storeId: string): Promise<ConnectorRunResult> {
  const startedAt = Date.now();
  const attemptedAt = new Date(startedAt).toISOString();
  const storeHealth = getStoreHealthMap(storeId);

  try {
    await connector.connect();
    const raw = await connector.fetch();
    const metrics = connector.transform(raw);

    if (!connector.validate(metrics)) {
      throw new ConnectorError({
        code: "connector_validation_failed",
        message: `Validation failed for connector ${connector.id}`,
        connectorId: connector.id,
      });
    }

    storeHealth.set(
      connector.id as ConnectorId,
      recordConnectorSuccess(connector.getHealth(), {
        latencyMs: Date.now() - startedAt,
        syncedAt: metrics.metadata.lastSyncedAt,
      }),
    );

    return {
      connectorId: connector.id as ConnectorId,
      status: "success",
      metrics,
      latencyMs: Date.now() - startedAt,
      attemptedAt,
    };
  } catch (error) {
    const connectorError =
      error instanceof ConnectorError
        ? error
        : new ConnectorError({
            code: "connector_sync_failed",
            message: error instanceof Error ? error.message : String(error),
            connectorId: connector.id,
            cause: error,
          });

    const previousHealth = storeHealth.get(connector.id as ConnectorId) ?? connector.getHealth();
    storeHealth.set(
      connector.id as ConnectorId,
      recordConnectorFailure(previousHealth, {
        error: connectorError.message,
        attemptedAt,
      }),
    );

    return {
      connectorId: connector.id as ConnectorId,
      status: "failed",
      error: connectorError.message,
      latencyMs: Date.now() - startedAt,
      attemptedAt,
    };
  }
}

export async function runAllConnectors(input: {
  context: ConnectorContext;
  connectorIds?: ConnectorId[];
}): Promise<ConnectorRunResult[]> {
  const connectorIds = input.connectorIds ?? listRegisteredConnectors();

  return Promise.all(
    connectorIds.map(async (connectorId) => {
      if (!registry.has(connectorId)) {
        return {
          connectorId,
          status: "skipped" as const,
          error: "connector_not_registered",
          latencyMs: 0,
          attemptedAt: new Date().toISOString(),
        };
      }

      const connector = getConnector(connectorId, input.context);
      return runConnectorOnce(connector, input.context.storeId);
    }),
  );
}

export function collectSuccessfulMetrics(
  runs: ConnectorRunResult[],
): Partial<Record<ConnectorId, NormalizedStoreMetrics>> {
  const connectors: Partial<Record<ConnectorId, NormalizedStoreMetrics>> = {};

  for (const run of runs) {
    if (run.status === "success" && run.metrics) {
      connectors[run.connectorId] = run.metrics;
    }
  }

  return connectors;
}

export function getStoreConnectorHealth(storeId: string): Partial<Record<ConnectorId, ConnectorHealth>> {
  const storeHealth = getStoreHealthMap(storeId);
  return Object.fromEntries(
    [...storeHealth.entries()].map(([connectorId, health]) => [connectorId, refreshConnectorHealthStatus(health)]),
  );
}

export { getStoreHealthMap };
