import type {
  ProductionDashboardData,
  ProductionHealthSnapshot,
  ProductionSubsystemHealth,
} from "../production-types";

export const STORE_ID = "store-test-001";

export function buildSubsystem(
  overrides: Partial<ProductionSubsystemHealth> & Pick<ProductionSubsystemHealth, "id" | "label">,
): ProductionSubsystemHealth {
  return {
    level: "healthy",
    healthScore: 100,
    lastSync: new Date().toISOString(),
    averageLatencyMs: 120,
    failureCount: 0,
    retryCount: 0,
    lastError: null,
    recoverySuggestion: null,
    nextRetry: null,
    details: {},
    ...overrides,
  };
}

export function buildSnapshot(
  overrides: Partial<ProductionHealthSnapshot> = {},
): ProductionHealthSnapshot {
  const subsystems = overrides.subsystems ?? [
    buildSubsystem({ id: "shopify", label: "Shopify" }),
    buildSubsystem({ id: "ga4", label: "Google Analytics", level: "offline", healthScore: 10 }),
  ];

  return {
    storeId: STORE_ID,
    computedAt: new Date().toISOString(),
    aggregationDurationMs: 42,
    overallLevel: "warning",
    overallHealthScore: 75,
    subsystems,
    dataQuality: {
      score: 65,
      completeness: 70,
      freshness: 60,
      reliability: 65,
      missingConnectors: ["ga4"],
      staleConnectors: [],
      impactChain: ["GA4 missing", "Traffic incomplete"],
    },
    alerts: [],
    syncTimeline: [],
    recoveryActions: [],
    ...overrides,
  };
}

export function buildDashboard(
  overrides: Partial<ProductionDashboardData> = {},
): ProductionDashboardData {
  const snapshot = buildSnapshot(overrides);
  return {
    ...snapshot,
    sections: overrides.sections ?? {
      connectors: snapshot.subsystems.filter((item) =>
        ["shopify", "ga4", "search_console", "pagespeed", "clarity"].includes(item.id),
      ),
      infrastructure: snapshot.subsystems.filter((item) => item.id === "database"),
      pipelines: snapshot.subsystems.filter((item) => item.id === "webhooks"),
      platforms: snapshot.subsystems.filter((item) => item.id === "ai_platform"),
    },
    settingsBadge: overrides.settingsBadge ?? { label: "Needs Attention", tone: "warning" },
    ...overrides,
  };
}
