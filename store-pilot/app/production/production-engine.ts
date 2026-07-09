import { buildRecoveryActions, generateProductionAlerts } from "./production-alerts";
import { buildDataQualitySubsystem, summarizeProductionHealth } from "./production-health";
import { appendProductionHistory, clearProductionHistory } from "./production-history";
import { computeProductionDataQuality } from "./production-data-quality";
import { monitorAutomationHealth, monitorOperationsHealth } from "./production-metrics";
import {
  monitorBackgroundJobs,
  monitorWorkerQueue,
} from "./production-job-monitor";
import {
  monitorAiPlatformHealth,
  monitorPerformanceHealth,
} from "./production-performance";
import { monitorSecurityHealth } from "./production-security";
import {
  monitorConnectorSubsystems,
  monitorDatabaseSubsystem,
  monitorOAuthAndBilling,
  monitorShopifySubsystem,
} from "./production-sync-monitor";
import { monitorWebhooks } from "./production-webhook-monitor";
import { upsertProductionNotifications, clearProductionNotifications } from "./production-notifications";
import { buildSyncTimeline } from "./production-dashboard";
import type { ProductionHealthSnapshot } from "./production-types";

export async function runProductionHealthEngine(storeId: string): Promise<ProductionHealthSnapshot> {
  const startedAt = Date.now();

  const [
    shopify,
    connectors,
    oauthBilling,
    database,
    webhooks,
    backgroundJobs,
    workerQueue,
    security,
    performance,
    aiPlatform,
    automation,
    operations,
    dataQuality,
  ] = await Promise.all([
    monitorShopifySubsystem(storeId),
    monitorConnectorSubsystems(storeId),
    monitorOAuthAndBilling(storeId),
    monitorDatabaseSubsystem(),
    monitorWebhooks(storeId),
    monitorBackgroundJobs(storeId),
    monitorWorkerQueue(),
    monitorSecurityHealth(),
    monitorPerformanceHealth(storeId),
    monitorAiPlatformHealth(storeId),
    monitorAutomationHealth(storeId),
    monitorOperationsHealth(storeId),
    computeProductionDataQuality(storeId),
  ]);

  const dataQualitySubsystem = buildDataQualitySubsystem(dataQuality);
  const subsystems = [
    shopify,
    ...connectors,
    ...oauthBilling,
    database,
    webhooks,
    backgroundJobs,
    workerQueue,
    security,
    performance,
    aiPlatform,
    automation,
    operations,
    dataQualitySubsystem,
  ];

  const { overallHealthScore, overallLevel } = summarizeProductionHealth(subsystems);
  const alerts = generateProductionAlerts({ subsystems, dataQuality });
  const syncTimeline = buildSyncTimeline(subsystems);

  const snapshot: ProductionHealthSnapshot = {
    storeId,
    computedAt: new Date().toISOString(),
    aggregationDurationMs: Date.now() - startedAt,
    overallLevel,
    overallHealthScore,
    subsystems,
    dataQuality,
    alerts,
    syncTimeline,
    recoveryActions: [],
  };

  snapshot.recoveryActions = buildRecoveryActions(snapshot);
  appendProductionHistory(snapshot);
  upsertProductionNotifications(storeId, alerts);

  return snapshot;
}

export function clearProductionEngineState(storeId?: string): void {
  clearProductionHistory(storeId);
  clearProductionNotifications(storeId);
}
