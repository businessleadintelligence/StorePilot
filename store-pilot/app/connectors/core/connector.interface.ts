import type { NormalizedStoreMetrics } from "../normalization/normalized-metrics";
import type { ConnectorHealth } from "./connector-health";

export interface BaseConnector {
  readonly id: string;
  connect(): Promise<void>;
  fetch(): Promise<unknown>;
  transform(raw: unknown): NormalizedStoreMetrics;
  validate(data: NormalizedStoreMetrics): boolean;
  getHealth(): ConnectorHealth;
}

export abstract class AbstractConnector implements BaseConnector {
  abstract readonly id: string;

  abstract connect(): Promise<void>;

  abstract fetch(): Promise<unknown>;

  abstract transform(raw: unknown): NormalizedStoreMetrics;

  validate(data: NormalizedStoreMetrics): boolean {
    return (
      typeof data.metadata?.source === "string" &&
      typeof data.metadata.lastSyncedAt === "string" &&
      Number.isFinite(data.traffic.sessions) &&
      Number.isFinite(data.traffic.users) &&
      Number.isFinite(data.conversion.rate) &&
      Number.isFinite(data.conversion.revenue) &&
      Number.isFinite(data.conversion.aov) &&
      Number.isFinite(data.seo.clicks) &&
      Number.isFinite(data.seo.impressions) &&
      Number.isFinite(data.seo.ctr) &&
      Number.isFinite(data.seo.averagePosition)
    );
  }

  abstract getHealth(): ConnectorHealth;
}
