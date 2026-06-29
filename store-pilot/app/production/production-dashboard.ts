import { badgeFromLevel } from "./production-status";
import type {
  ProductionDashboardData,
  ProductionHealthSnapshot,
  ProductionSubsystemHealth,
} from "./production-types";

const CONNECTOR_IDS = new Set([
  "shopify",
  "ga4",
  "search_console",
  "pagespeed",
  "clarity",
  "unified_metrics",
  "connector_cache",
]);

const INFRASTRUCTURE_IDS = new Set([
  "database",
  "worker_queue",
  "security",
  "oauth_tokens",
  "billing",
  "performance",
]);

const PIPELINE_IDS = new Set(["webhooks", "background_jobs"]);

const PLATFORM_IDS = new Set(["ai_platform", "automation", "operations", "data_quality"]);

export function buildProductionDashboard(
  snapshot: ProductionHealthSnapshot,
): ProductionDashboardData {
  return {
    ...snapshot,
    sections: {
      connectors: filterSubsystems(snapshot.subsystems, CONNECTOR_IDS),
      infrastructure: filterSubsystems(snapshot.subsystems, INFRASTRUCTURE_IDS),
      pipelines: filterSubsystems(snapshot.subsystems, PIPELINE_IDS),
      platforms: filterSubsystems(snapshot.subsystems, PLATFORM_IDS),
    },
    settingsBadge: badgeFromLevel(snapshot.overallLevel),
  };
}

export function buildSyncTimeline(subsystems: ProductionSubsystemHealth[]) {
  return subsystems
    .filter((item) => item.lastSync || item.id === "shopify")
    .map((item) => ({
      label: item.label,
      at: item.lastSync,
      level: item.level,
    }))
    .sort((left, right) => {
      const leftTime = left.at ? Date.parse(left.at) : 0;
      const rightTime = right.at ? Date.parse(right.at) : 0;
      return rightTime - leftTime;
    });
}

function filterSubsystems(
  subsystems: ProductionSubsystemHealth[],
  ids: Set<string>,
): ProductionSubsystemHealth[] {
  return subsystems.filter((item) => ids.has(item.id));
}

export function serializeProductionDashboardForLoader(
  dashboard: ProductionDashboardData,
): ProductionDashboardData {
  return JSON.parse(JSON.stringify(dashboard)) as ProductionDashboardData;
}
