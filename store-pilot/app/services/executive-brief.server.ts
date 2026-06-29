import {
  calculateStoreHealthScore,
  type StoreHealthScore,
} from "./health-score.server";
import { formatCurrency, getStoreMetrics, type StoreMetrics } from "./metrics.server";
import { getStoreSyncStatus, type StoreSyncStatus } from "./sync-status.server";

export type ExecutiveBriefMetrics = {
  products: number;
  orders: number;
  grossRevenue: number;
  healthScore: number;
  grade: StoreHealthScore["grade"];
};

export type ExecutiveBrief = {
  headline: string;
  summary: string;
  metrics: ExecutiveBriefMetrics;
  highlights: string[];
  concerns: string[];
};

export type ExecutiveBriefInput = {
  metrics: StoreMetrics;
  healthScore: StoreHealthScore;
  syncStatus: StoreSyncStatus | null;
  currency?: string;
};

export function buildExecutiveHeadline(
  metrics: StoreMetrics,
  healthScore: StoreHealthScore,
): string {
  if (metrics.products === 0) {
    return "Store setup is not complete";
  }

  if (metrics.orders === 0) {
    return "Products are synced but no orders have been imported";
  }

  if (healthScore.score >= 90) {
    return "Store operations are healthy";
  }

  if (healthScore.score >= 70) {
    return "Store operations require attention";
  }

  return "Store health needs improvement";
}

export function buildExecutiveSummary(
  metrics: StoreMetrics,
  healthScore: StoreHealthScore,
  currency = "USD",
): string {
  if (metrics.products === 0) {
    return "No products have been synced yet.";
  }

  const parts = [
    `${metrics.products} product${metrics.products === 1 ? "" : "s"} are synced.`,
  ];

  if (metrics.orders > 0) {
    parts.push(
      `${metrics.orders} order${metrics.orders === 1 ? "" : "s"} have been imported.`,
    );
  }

  parts.push(`Store health score is ${healthScore.score}.`);

  if (metrics.grossRevenue > 0) {
    parts.push(
      `${formatCurrency(metrics.grossRevenue, currency)} revenue has been recorded.`,
    );
  }

  return parts.join(" ");
}

export function buildExecutiveHighlights(
  metrics: StoreMetrics,
  currency = "USD",
): string[] {
  const highlights: string[] = [];

  if (metrics.products > 0) {
    highlights.push(
      metrics.products === 1
        ? "1 product synced"
        : `${metrics.products} products synced`,
    );
  }

  if (metrics.orders > 0) {
    highlights.push(
      metrics.orders === 1
        ? "1 order imported"
        : `${metrics.orders} orders imported`,
    );
  }

  if (metrics.grossRevenue > 0) {
    highlights.push(
      `${formatCurrency(metrics.grossRevenue, currency)} revenue recorded`,
    );
  }

  return highlights;
}

export function buildExecutiveConcerns(
  healthScore: StoreHealthScore,
  syncStatus: StoreSyncStatus | null,
): string[] {
  const concerns = [...healthScore.issues];

  if (syncStatus?.orders.blocked) {
    concerns.push("Orders sync is waiting for Shopify approval");
  }

  return concerns;
}

export function calculateExecutiveBrief(
  input: ExecutiveBriefInput,
): ExecutiveBrief {
  const currency = input.currency ?? "USD";

  return {
    headline: buildExecutiveHeadline(input.metrics, input.healthScore),
    summary: buildExecutiveSummary(
      input.metrics,
      input.healthScore,
      currency,
    ),
    metrics: {
      products: Math.max(0, input.metrics.products),
      orders: Math.max(0, input.metrics.orders),
      grossRevenue: Math.max(0, input.metrics.grossRevenue),
      healthScore: input.healthScore.score,
      grade: input.healthScore.grade,
    },
    highlights: buildExecutiveHighlights(input.metrics, currency),
    concerns: buildExecutiveConcerns(input.healthScore, input.syncStatus),
  };
}

export function serializeExecutiveBriefForLoader(
  brief: ExecutiveBrief,
): ExecutiveBrief {
  return {
    headline: brief.headline,
    summary: brief.summary,
    metrics: { ...brief.metrics },
    highlights: [...brief.highlights],
    concerns: [...brief.concerns],
  };
}

export async function getExecutiveBrief(
  storeId: string,
  currency = "USD",
): Promise<ExecutiveBrief> {
  const [metrics, syncStatus] = await Promise.all([
    getStoreMetrics(storeId),
    getStoreSyncStatus(storeId),
  ]);
  const healthScore = calculateStoreHealthScore(metrics);

  return serializeExecutiveBriefForLoader(
    calculateExecutiveBrief({
      metrics,
      healthScore,
      syncStatus,
      currency,
    }),
  );
}
