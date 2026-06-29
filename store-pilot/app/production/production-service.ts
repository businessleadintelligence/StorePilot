import {
  buildProductionDashboard,
  serializeProductionDashboardForLoader,
} from "./production-dashboard";
import { runProductionHealthEngine } from "./production-engine";
import { isProductionSnapshotStale } from "./production-health";
import { badgeFromLevel } from "./production-status";
import type { ProductionDashboardData } from "./production-types";

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { expiresAt: number; dashboard: ProductionDashboardData }>();

export async function getProductionHealthDashboard(
  storeId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<ProductionDashboardData> {
  const cached = cache.get(storeId);
  if (!options.forceRefresh && cached && Date.now() < cached.expiresAt) {
    return cached.dashboard;
  }

  const snapshot = await runProductionHealthEngine(storeId);
  const dashboard = buildProductionDashboard(snapshot);
  cache.set(storeId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    dashboard,
  });
  return dashboard;
}

export async function getProductionHealthBadge(storeId: string) {
  const cached = cache.get(storeId);
  if (cached && !isProductionSnapshotStale(cached.dashboard, CACHE_TTL_MS)) {
    return cached.dashboard.settingsBadge;
  }

  const dashboard = await getProductionHealthDashboard(storeId);
  return dashboard.settingsBadge;
}

export function serializeProductionDashboardForRoute(
  dashboard: ProductionDashboardData,
): ProductionDashboardData {
  return serializeProductionDashboardForLoader(dashboard);
}

export function clearProductionHealthCache(storeId?: string): void {
  if (storeId) {
    cache.delete(storeId);
    return;
  }
  cache.clear();
}

export function getCachedProductionBadge(storeId: string) {
  const cached = cache.get(storeId);
  if (!cached) {
    return badgeFromLevel("unknown");
  }
  return cached.dashboard.settingsBadge;
}
