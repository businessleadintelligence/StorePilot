import { fetchPageSpeedInsightsReport } from "../../google/pagespeed/pagespeed-client";
import {
  parsePageSpeedReport,
  type PageSpeedRawReport,
} from "../../google/pagespeed/pagespeed-parser";
import { GoogleApiError } from "../../google/shared/google-api-error";
import { getValidGoogleAccessToken } from "../../google/oauth/google-token.service";
import {
  loadActiveGoogleIntegrationForPageSpeedConnector,
  markGoogleIntegrationRevoked,
  resolvePageSpeedStoreUrlForConnector,
} from "../../services/google-integration.server";
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

export type { PageSpeedRawReport } from "../../google/pagespeed/pagespeed-parser";

type PageSpeedConnectorDeps = {
  loadIntegration: typeof loadActiveGoogleIntegrationForPageSpeedConnector;
  resolveStoreUrl: typeof resolvePageSpeedStoreUrlForConnector;
  fetchReport: typeof fetchPageSpeedInsightsReport;
  getAccessToken: typeof getValidGoogleAccessToken;
  markRevoked: typeof markGoogleIntegrationRevoked;
};

const defaultDeps: PageSpeedConnectorDeps = {
  loadIntegration: loadActiveGoogleIntegrationForPageSpeedConnector,
  resolveStoreUrl: resolvePageSpeedStoreUrlForConnector,
  fetchReport: fetchPageSpeedInsightsReport,
  getAccessToken: getValidGoogleAccessToken,
  markRevoked: markGoogleIntegrationRevoked,
};

let connectorDeps: PageSpeedConnectorDeps = defaultDeps;

export function configurePageSpeedConnectorDeps(
  overrides: Partial<PageSpeedConnectorDeps>,
): void {
  connectorDeps = { ...defaultDeps, ...overrides };
}

export function resetPageSpeedConnectorDeps(): void {
  connectorDeps = defaultDeps;
}

export class PageSpeedConnector extends AbstractConnector {
  readonly id = "pagespeed";
  private readonly context: ConnectorContext;
  private connected = false;
  private health: ConnectorHealth = createInitialConnectorHealth();
  private pageUrl: string | null = null;

  constructor(context: ConnectorContext) {
    super();
    this.context = context;
  }

  async connect(): Promise<void> {
    const integration = await connectorDeps.loadIntegration(this.context.storeId);

    if (!integration) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Google PageSpeed is not connected for this store",
        retryable: false,
      });
    }

    const pageUrl = await connectorDeps.resolveStoreUrl(
      this.context.storeId,
      integration,
      this.context.pageUrl,
    );

    if (!pageUrl) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Storefront URL is required for PageSpeed analysis",
        retryable: false,
      });
    }

    this.pageUrl = pageUrl;
    this.connected = true;
  }

  async fetch(): Promise<PageSpeedRawReport> {
    if (!this.connected || !this.pageUrl) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "PageSpeed connector is not connected",
        retryable: false,
      });
    }

    const integration = await connectorDeps.loadIntegration(this.context.storeId);
    if (!integration) {
      throw new GoogleApiError({
        code: "missing_property",
        message: "Google PageSpeed integration not found",
        retryable: false,
      });
    }

    try {
      const token = await connectorDeps.getAccessToken(integration);
      return connectorDeps.fetchReport({
        pageUrl: this.pageUrl,
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
    const metrics = parsePageSpeedReport(raw as PageSpeedRawReport, syncedAt);
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

export function createPageSpeedConnector(context: ConnectorContext): PageSpeedConnector {
  return new PageSpeedConnector(context);
}
