import { fetchClarityAnalyticsReport } from "../../microsoft/clarity/clarity-client";
import {
  parseClarityReport,
  type ClarityRawReport,
} from "../../microsoft/clarity/clarity-parser";
import { ClarityApiError } from "../../microsoft/clarity/clarity-api-error";
import {
  getClarityApiToken,
  loadActiveClarityIntegrationForConnector,
  markClarityIntegrationRevoked,
} from "../support/clarity-connector-integration.server";
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

export type { ClarityRawReport } from "../../microsoft/clarity/clarity-parser";

type ClarityConnectorDeps = {
  loadIntegration: typeof loadActiveClarityIntegrationForConnector;
  fetchReport: typeof fetchClarityAnalyticsReport;
  getApiToken: typeof getClarityApiToken;
  markRevoked: typeof markClarityIntegrationRevoked;
};

const defaultDeps: ClarityConnectorDeps = {
  loadIntegration: loadActiveClarityIntegrationForConnector,
  fetchReport: fetchClarityAnalyticsReport,
  getApiToken: getClarityApiToken,
  markRevoked: markClarityIntegrationRevoked,
};

let connectorDeps: ClarityConnectorDeps = defaultDeps;

export function configureClarityConnectorDeps(overrides: Partial<ClarityConnectorDeps>): void {
  connectorDeps = { ...defaultDeps, ...overrides };
}

export function resetClarityConnectorDeps(): void {
  connectorDeps = defaultDeps;
}

export class ClarityConnector extends AbstractConnector {
  readonly id = "clarity";
  private readonly context: ConnectorContext;
  private connected = false;
  private health: ConnectorHealth = createInitialConnectorHealth();
  private projectId: string | null = null;

  constructor(context: ConnectorContext) {
    super();
    this.context = context;
  }

  async connect(): Promise<void> {
    const integration = await connectorDeps.loadIntegration(this.context.storeId);

    if (!integration?.projectId) {
      throw new ClarityApiError({
        code: "missing_project",
        message: "Microsoft Clarity is not connected for this store",
        retryable: false,
      });
    }

    this.projectId = integration.projectId;
    this.connected = true;
  }

  async fetch(): Promise<ClarityRawReport> {
    if (!this.connected || !this.projectId) {
      throw new ClarityApiError({
        code: "missing_project",
        message: "Clarity connector is not connected",
        retryable: false,
      });
    }

    const integration = await connectorDeps.loadIntegration(this.context.storeId);
    if (!integration) {
      throw new ClarityApiError({
        code: "missing_project",
        message: "Microsoft Clarity integration not found",
        retryable: false,
      });
    }

    try {
      const apiToken = connectorDeps.getApiToken(integration);
      return connectorDeps.fetchReport({
        projectId: this.projectId,
        apiToken,
      });
    } catch (error) {
      if (
        error instanceof ClarityApiError &&
        (error.code === "revoked_credentials" || error.code === "expired_token")
      ) {
        await connectorDeps.markRevoked(this.context.storeId, error.message);
      }
      throw error;
    }
  }

  transform(raw: unknown): NormalizedStoreMetrics {
    const syncedAt = isoNow();
    const metrics = parseClarityReport(raw as ClarityRawReport, syncedAt);
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

export function createClarityConnector(context: ConnectorContext): ClarityConnector {
  return new ClarityConnector(context);
}
