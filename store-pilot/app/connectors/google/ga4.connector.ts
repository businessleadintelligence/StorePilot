import { fetchGa4AnalyticsReport } from "../../google/analytics/ga4-client";
import { parseGa4Report, type Ga4RawReport } from "../../google/analytics/ga4-parser";
import { GoogleApiError } from "../../google/shared/google-api-error";
import { getValidGoogleAccessToken } from "../../google/oauth/google-token.service";
import { loadActiveGoogleIntegrationForConnector, markGoogleIntegrationRevoked } from "../../services/google-integration.server";
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

export type { Ga4RawReport } from "../../google/analytics/ga4-parser";

type Ga4ConnectorDeps = {
  loadIntegration: typeof loadActiveGoogleIntegrationForConnector;
  fetchReport: typeof fetchGa4AnalyticsReport;
  getAccessToken: typeof getValidGoogleAccessToken;
  markRevoked: typeof markGoogleIntegrationRevoked;
};

const defaultDeps: Ga4ConnectorDeps = {
  loadIntegration: loadActiveGoogleIntegrationForConnector,
  fetchReport: fetchGa4AnalyticsReport,
  getAccessToken: getValidGoogleAccessToken,
  markRevoked: markGoogleIntegrationRevoked,
};

let connectorDeps: Ga4ConnectorDeps = defaultDeps;

export function configureGa4ConnectorDeps(overrides: Partial<Ga4ConnectorDeps>): void {
  connectorDeps = { ...defaultDeps, ...overrides };
}

export function resetGa4ConnectorDeps(): void {
  connectorDeps = defaultDeps;
}

export class Ga4Connector extends AbstractConnector {
  readonly id = "ga4";
  private readonly context: ConnectorContext;
  private connected = false;
  private health: ConnectorHealth = createInitialConnectorHealth();
  private integrationId: string | null = null;
  private propertyId: string | null = null;

  constructor(context: ConnectorContext) {
    super();
    this.context = context;
  }

  async connect(): Promise<void> {
    const integration = await connectorDeps.loadIntegration(this.context.storeId);

    if (!integration?.analyticsPropertyId) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Google Analytics is not connected for this store",
        retryable: false,
      });
    }

    this.integrationId = integration.id;
    this.propertyId = integration.analyticsPropertyId;
    this.connected = true;
  }

  async fetch(): Promise<Ga4RawReport> {
    if (!this.connected || !this.propertyId) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "GA4 connector is not connected",
        retryable: false,
      });
    }

    const integration = await connectorDeps.loadIntegration(this.context.storeId);
    if (!integration) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Google Analytics integration not found",
        retryable: false,
      });
    }

    try {
      const token = await connectorDeps.getAccessToken(integration);
      return connectorDeps.fetchReport({
        propertyId: this.propertyId,
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
    const metrics = parseGa4Report(raw as Ga4RawReport, syncedAt);
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

export function createGa4Connector(context: ConnectorContext): Ga4Connector {
  return new Ga4Connector(context);
}
