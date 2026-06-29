import prisma from "../db.server";
import { getCachedUnifiedMetrics, getConnectorCacheEntry } from "../connectors/core/connector-cache";
import { getConnectorStatus } from "../connectors/core/connector.registry";
import { getGoogleIntegrationPublicView } from "../services/google-integration.server";
import { getClarityIntegrationPublicView } from "../services/clarity-integration.server";
import { getStoreSyncStatus } from "../services/sync-status.server";
import { buildSubsystemHealth, levelFromFailureCount, levelFromSyncTimestamp } from "./production-checks";
import type { ProductionSubsystemHealth } from "./production-types";

export async function monitorConnectorSubsystems(storeId: string): Promise<ProductionSubsystemHealth[]> {
  const [google, clarity, unifiedMetrics, unifiedCacheEntry, connectorStatuses] = await Promise.all([
    getGoogleIntegrationPublicView(storeId),
    getClarityIntegrationPublicView(storeId),
    Promise.resolve(getCachedUnifiedMetrics(storeId)),
    Promise.resolve(getConnectorCacheEntry(storeId)),
    Promise.resolve(getConnectorStatus(storeId)),
  ]);

  const ga4Health = connectorStatuses.find((item) => item.connectorId === "ga4")?.health;
  const gscHealth = connectorStatuses.find((item) => item.connectorId === "gsc")?.health;
  const pageSpeedHealth = connectorStatuses.find((item) => item.connectorId === "pagespeed")?.health;
  const clarityHealth = connectorStatuses.find((item) => item.connectorId === "clarity")?.health;

  return [
    buildSubsystemHealth({
      id: "ga4",
      label: "Google Analytics",
      level: google.connected
        ? levelFromSyncTimestamp(google.lastSyncAt, true)
        : google.googleAnalyticsSkipped
          ? "warning"
          : "offline",
      lastSync: google.lastSyncAt,
      averageLatencyMs: ga4Health?.latencyMs ?? null,
      failureCount: ga4Health?.consecutiveFailures ?? 0,
      lastError: ga4Health?.lastError ?? null,
      recoverySuggestion: google.connected
        ? "Retry GA4 sync from Settings"
        : "Connect Google Analytics in Settings",
      details: {
        connected: google.connected,
        configured: google.configured,
        needsPropertySelection: google.needsPropertySelection,
      },
    }),
    buildSubsystemHealth({
      id: "search_console",
      label: "Search Console",
      level: google.searchConsoleSiteUrl
        ? levelFromSyncTimestamp(google.searchConsoleLastSyncAt, true)
        : "offline",
      lastSync: google.searchConsoleLastSyncAt,
      averageLatencyMs: gscHealth?.latencyMs ?? null,
      failureCount: gscHealth?.consecutiveFailures ?? 0,
      lastError: gscHealth?.lastError ?? null,
      recoverySuggestion: "Verify Search Console property in Settings",
      details: {
        connected: Boolean(google.searchConsoleSiteUrl),
        needsPropertySelection: google.needsSearchConsolePropertySelection,
      },
    }),
    buildSubsystemHealth({
      id: "pagespeed",
      label: "PageSpeed Insights",
      level: google.pageSpeedAvailable
        ? levelFromSyncTimestamp(google.pageSpeedLastSyncAt, true)
        : "offline",
      lastSync: google.pageSpeedLastSyncAt,
      averageLatencyMs: pageSpeedHealth?.latencyMs ?? null,
      failureCount: pageSpeedHealth?.consecutiveFailures ?? 0,
      lastError: pageSpeedHealth?.lastError ?? null,
      recoverySuggestion: "Configure storefront URL and retry PageSpeed sync",
      details: { available: google.pageSpeedAvailable },
    }),
    buildSubsystemHealth({
      id: "clarity",
      label: "Microsoft Clarity",
      level: clarity.connected
        ? levelFromSyncTimestamp(clarity.lastSyncAt, true)
        : "offline",
      lastSync: clarity.lastSyncAt,
      averageLatencyMs: clarityHealth?.latencyMs ?? null,
      failureCount: clarityHealth?.consecutiveFailures ?? 0,
      lastError: clarityHealth?.lastError ?? null,
      recoverySuggestion: clarity.connected
        ? "Retry Clarity sync from Settings"
        : "Connect Microsoft Clarity in Settings",
      details: {
        connected: clarity.connected,
        needsProjectSelection: clarity.needsProjectSelection,
      },
    }),
    buildSubsystemHealth({
      id: "unified_metrics",
      label: "Unified Store Metrics",
      level: unifiedMetrics ? "healthy" : "warning",
      lastSync: unifiedMetrics?.lastSyncAt ?? null,
      recoverySuggestion: unifiedMetrics ? null : "Run connector sync to populate unified metrics cache",
      details: {
        cacheHit: Boolean(unifiedMetrics),
        dataQualityScore: unifiedMetrics?.dataQuality.score ?? 0,
      },
    }),
    buildSubsystemHealth({
      id: "connector_cache",
      label: "Connector Cache",
      level: unifiedCacheEntry ? "healthy" : "warning",
      lastSync: unifiedCacheEntry ? unifiedCacheEntry.cachedAt : null,
      details: {
        expiresAt: unifiedCacheEntry ? unifiedCacheEntry.expiresAt : null,
      },
    }),
  ];
}

export async function monitorShopifySubsystem(storeId: string): Promise<ProductionSubsystemHealth> {
  const syncStatus = await getStoreSyncStatus(storeId);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { active: true, lastProductsSyncAt: true, lastInventorySyncAt: true, lastOrdersSyncAt: true },
  });

  const domains = [syncStatus.products, syncStatus.inventory, syncStatus.orders];
  const syncedCount = domains.filter((domain) => domain.synced).length;
  const level =
    store?.active === false
      ? "offline"
      : syncedCount === 3
        ? "healthy"
        : syncedCount > 0
          ? "warning"
          : "critical";

  return buildSubsystemHealth({
    id: "shopify",
    label: "Shopify",
    level,
    lastSync:
      [store?.lastProductsSyncAt, store?.lastInventorySyncAt, store?.lastOrdersSyncAt]
        .filter(Boolean)
        .map((value) => value!.toISOString())
        .sort()
        .at(-1) ?? null,
    recoverySuggestion:
      level === "healthy" ? null : "Open Dashboard sync status and retry blocked domains",
    details: {
      productsSynced: syncStatus.products.synced,
      inventorySynced: syncStatus.inventory.synced,
      ordersSynced: syncStatus.orders.synced,
      active: store?.active ?? false,
    },
  });
}

export async function monitorOAuthAndBilling(storeId: string): Promise<ProductionSubsystemHealth[]> {
  const [google, clarity, subscription] = await Promise.all([
    getGoogleIntegrationPublicView(storeId),
    getClarityIntegrationPublicView(storeId),
    prisma.subscription.findFirst({
      where: { storeId },
      orderBy: { updatedAt: "desc" },
      select: { status: true, currentPeriodEnd: true, trialEndsAt: true },
    }),
  ]);

  const oauthHealthy = google.isActive || clarity.connected;
  const billingLevel =
    subscription?.status === "active" || subscription?.status === "trialing"
      ? "healthy"
      : subscription
        ? "warning"
        : "unknown";

  return [
    buildSubsystemHealth({
      id: "oauth_tokens",
      label: "OAuth Tokens",
      level: oauthHealthy ? "healthy" : "warning",
      recoverySuggestion: oauthHealthy ? null : "Reconnect Google or Clarity integrations",
      details: {
        googleActive: google.isActive,
        clarityConnected: clarity.connected,
      },
    }),
    buildSubsystemHealth({
      id: "billing",
      label: "Billing",
      level: billingLevel,
      recoverySuggestion:
        billingLevel === "healthy" ? null : "Review subscription status in billing settings",
      details: {
        status: subscription?.status ?? "unknown",
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      },
    }),
  ];
}

export async function monitorDatabaseSubsystem(): Promise<ProductionSubsystemHealth> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return buildSubsystemHealth({
      id: "database",
      label: "Database",
      level: "healthy",
      averageLatencyMs: Date.now() - startedAt,
      details: { prisma: true },
    });
  } catch (error) {
    return buildSubsystemHealth({
      id: "database",
      label: "Database",
      level: "critical",
      lastError: error instanceof Error ? error.message : "database_unreachable",
      recoverySuggestion: "Verify DATABASE_URL and database availability",
    });
  }
}
