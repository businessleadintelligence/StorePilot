import { buildRecoveryActions, generateProductionAlerts } from "./production-alerts";
import { buildSubsystemHealth } from "./production-checks";
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
import type {
  ProductionDataQualityExplanation,
  ProductionHealthSnapshot,
  ProductionSubsystemHealth,
} from "./production-types";

type MonitorStepResult = ProductionSubsystemHealth | ProductionSubsystemHealth[];

async function runMonitorStep(
  label: string,
  monitor: () => Promise<MonitorStepResult>,
): Promise<ProductionSubsystemHealth[]> {
  try {
    const result = await monitor();
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    console.error("[production-health]", {
      message: "Subsystem monitor failed",
      subsystem: label,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return [];
  }
}

function buildUnavailableDataQuality(): ProductionDataQualityExplanation {
  return {
    score: 0,
    completeness: 0,
    freshness: 0,
    reliability: 0,
    missingConnectors: [],
    staleConnectors: [],
    impactChain: ["System health checks were unavailable during this request."],
  };
}

function buildDegradedProductionSnapshot(
  storeId: string,
  startedAt: number,
  reason: string,
): ProductionHealthSnapshot {
  const subsystem = buildSubsystemHealth({
    id: "database",
    label: "Database",
    level: "unknown",
    lastError: reason,
    recoverySuggestion: "Retry system health shortly",
  });
  const dataQuality = buildUnavailableDataQuality();
  const dataQualitySubsystem = buildDataQualitySubsystem(dataQuality);
  const subsystems = [subsystem, dataQualitySubsystem];
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
  return snapshot;
}

export async function runProductionHealthEngine(storeId: string): Promise<ProductionHealthSnapshot> {
  const startedAt = Date.now();

  try {
    const subsystems: ProductionSubsystemHealth[] = [];

    for (const step of [
      ["shopify", () => monitorShopifySubsystem(storeId)],
      ["connectors", () => monitorConnectorSubsystems(storeId)],
      ["oauth_billing", () => monitorOAuthAndBilling(storeId)],
      ["database", () => monitorDatabaseSubsystem()],
      ["webhooks", () => monitorWebhooks(storeId)],
      ["background_jobs", () => monitorBackgroundJobs(storeId)],
      ["worker_queue", () => monitorWorkerQueue()],
      ["security", () => monitorSecurityHealth()],
      ["performance", () => monitorPerformanceHealth(storeId)],
      ["ai_platform", () => monitorAiPlatformHealth(storeId)],
      ["automation", () => monitorAutomationHealth(storeId)],
      ["operations", () => monitorOperationsHealth(storeId)],
    ] as const) {
      subsystems.push(...(await runMonitorStep(step[0], step[1])));
    }

    let dataQuality = buildUnavailableDataQuality();
    try {
      dataQuality = await computeProductionDataQuality(storeId);
    } catch (error) {
      console.error("[production-health]", {
        message: "Data quality monitor failed",
        storeId,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }

    const dataQualitySubsystem = buildDataQualitySubsystem(dataQuality);
    subsystems.push(dataQualitySubsystem);

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
  } catch (error) {
    const reason = error instanceof Error ? error.message : "production_health_engine_failed";
    console.error("[production-health]", {
      message: "Production health engine failed",
      storeId,
      reason,
    });
    return buildDegradedProductionSnapshot(storeId, startedAt, reason);
  }
}

export function clearProductionEngineState(storeId?: string): void {
  clearProductionHistory(storeId);
  clearProductionNotifications(storeId);
}
