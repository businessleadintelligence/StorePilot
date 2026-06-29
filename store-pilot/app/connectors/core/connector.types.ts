import { CONNECTOR_SOURCES, type ConnectorSource } from "../normalization/normalized-metrics";

export type ConnectorId = ConnectorSource;

export const ALL_CONNECTOR_IDS: ConnectorId[] = [...CONNECTOR_SOURCES];

export type ConnectorContext = {
  storeId: string;
  propertyId?: string;
  siteUrl?: string;
  pageUrl?: string;
  projectId?: string;
};

export type ConnectorCredentials = {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
};

export type ConnectorRunStatus = "success" | "failed" | "skipped";

export type ConnectorRunResult = {
  connectorId: ConnectorId;
  status: ConnectorRunStatus;
  metrics?: import("../normalization/normalized-metrics").NormalizedStoreMetrics;
  error?: string;
  latencyMs: number;
  attemptedAt: string;
};

export type ConnectorRegistryStatus = {
  connectorId: ConnectorId;
  registered: boolean;
  health: import("./connector-health").ConnectorHealth;
};

export type ConnectorSyncOptions = {
  connectorIds?: ConnectorId[];
  useCache?: boolean;
  cacheTtlMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  forceRefresh?: boolean;
};

export type ConnectorSyncResult = {
  storeId: string;
  metrics: import("../normalization/normalized-metrics").UnifiedStoreMetrics;
  runs: ConnectorRunResult[];
  fromCache: boolean;
};

export type ConnectorFactory = (context: ConnectorContext) => import("./connector.interface").BaseConnector;
