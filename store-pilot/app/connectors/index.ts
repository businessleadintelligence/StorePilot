import { registerConnector } from "./core/connector.registry";
import { createGa4Connector } from "./google/ga4.connector";
import { createPageSpeedConnector } from "./google/pagespeed.connector";
import { createSearchConsoleConnector } from "./google/search-console.connector";
import { createClarityConnector } from "./microsoft/clarity.connector";

let bootstrapped = false;

export function bootstrapConnectorPlatform(): void {
  if (bootstrapped) return;

  registerConnector("ga4", createGa4Connector);
  registerConnector("gsc", createSearchConsoleConnector);
  registerConnector("pagespeed", createPageSpeedConnector);
  registerConnector("clarity", createClarityConnector);

  bootstrapped = true;
}

export function resetConnectorPlatformBootstrap(): void {
  bootstrapped = false;
}

export * from "./normalization/normalized-metrics";
export * from "./normalization/metrics-transformer";
export * from "./core/connector.interface";
export * from "./core/connector.types";
export * from "./core/connector-errors";
export * from "./core/connector-health";
export * from "./core/connector-cache";
export * from "./core/data-quality";
export * from "./core/data-quality-warnings";
export * from "./core/connector.registry";
export * from "./core/connector-sync-engine";
export * from "./core/connector-utils";
export * from "./google/ga4.connector";
export * from "./google/search-console.connector";
export * from "./google/pagespeed.connector";
export * from "./microsoft/clarity.connector";

export { syncStoreConnectors as syncExternalStoreMetrics } from "./core/connector-sync-engine";
