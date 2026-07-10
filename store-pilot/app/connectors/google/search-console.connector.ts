import { fetchGscSearchConsoleReport } from "../../google/search-console/gsc-client";
import { parseGscReport, type GscRawReport } from "../../google/search-console/gsc-parser";
import { GoogleApiError } from "../../google/shared/google-api-error";
import { getValidGoogleAccessToken } from "../../google/oauth/google-token.service";
import {
  loadActiveGoogleIntegrationForGscConnector,
  markGoogleIntegrationRevoked,
} from "../support/google-connector-integration.server";
import type { NormalizedStoreMetrics } from "../normalization/normalized-metrics";
import { computeConnectorDataQualityScore } from "../core/data-quality";
import { AbstractConnector } from "../core/connector.interface";
import {
  createInitialConnectorHealth,
  recordConnectorFailure,
  recordConnectorSuccess,
  type ConnectorHealth,
} from "../core/connector-health";
import type { ConnectorContext } from "../core/connector.types";
import { isoNow } from "../core/connector-utils";

export type { GscRawReport } from "../../google/search-console/gsc-parser";

type GscConnectorDeps = {
  loadIntegration: typeof loadActiveGoogleIntegrationForGscConnector;
  fetchReport: typeof fetchGscSearchConsoleReport;
  getAccessToken: typeof getValidGoogleAccessToken;
  markRevoked: typeof markGoogleIntegrationRevoked;
};

const defaultDeps: GscConnectorDeps = {
  loadIntegration: loadActiveGoogleIntegrationForGscConnector,
  fetchReport: fetchGscSearchConsoleReport,
  getAccessToken: getValidGoogleAccessToken,
  markRevoked: markGoogleIntegrationRevoked,
};

let connectorDeps: GscConnectorDeps = defaultDeps;

export function configureGscConnectorDeps(overrides: Partial<GscConnectorDeps>): void {
  connectorDeps = { ...defaultDeps, ...overrides };
}

export function resetGscConnectorDeps(): void {
  connectorDeps = defaultDeps;
}

export class SearchConsoleConnector extends AbstractConnector {
  readonly id = "gsc";
  private readonly context: ConnectorContext;
  private connected = false;
  private health: ConnectorHealth = createInitialConnectorHealth();
  private siteUrl: string | null = null;

  constructor(context: ConnectorContext) {
    super();
    this.context = context;
  }

  async connect(): Promise<void> {
    const integration = await connectorDeps.loadIntegration(this.context.storeId);

    if (!integration?.searchConsoleSiteUrl) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Google Search Console is not connected for this store",
        retryable: false,
      });
    }

    this.siteUrl = integration.searchConsoleSiteUrl;
    this.connected = true;
  }

  async fetch(): Promise<GscRawReport> {
    if (!this.connected || !this.siteUrl) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Search Console connector is not connected",
        retryable: false,
      });
    }

    const integration = await connectorDeps.loadIntegration(this.context.storeId);
    if (!integration) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Google Search Console integration not found",
        retryable: false,
      });
    }

    try {
      const token = await connectorDeps.getAccessToken(integration);
      return connectorDeps.fetchReport({
        siteUrl: this.siteUrl,
        accessToken: token.accessToken,
      });
    } catch (error) {
      if (error instanceof GoogleApiError && error.code === "revoked_consent") {
        await connectorDeps.markRevoked(this.context.storeId, error.message);
      }
      throw error;
    }
  }

  transform(raw: unknown): NormalizedStoreMetrics {
    const syncedAt = isoNow();
    const metrics = parseGscReport(raw as GscRawReport, syncedAt);
    metrics.metadata.dataQualityScore = computeConnectorDataQualityScore(metrics);
    this.health = recordConnectorSuccess(this.health, { latencyMs: this.health.latencyMs, syncedAt });
    return metrics;
  }

  getHealth(): ConnectorHealth {
    return this.health;
  }

  markFailure(error: string): void {
    this.health = recordConnectorFailure(this.health, { error });
  }
}

export function createSearchConsoleConnector(context: ConnectorContext): SearchConsoleConnector {
  return new SearchConsoleConnector(context);
}
