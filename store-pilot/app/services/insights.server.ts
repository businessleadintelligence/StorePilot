import {
  calculateStoreHealthScore,
  type StoreHealthScore,
} from "./health-score.server";
import { formatMetricNumber, getStoreMetrics, type StoreMetrics } from "./metrics.server";
import {
  getOnboardingStatus,
  type OnboardingStatusResponse,
} from "./onboarding-ui.server";

export type InsightSeverity = "critical" | "warning" | "info";

export type InsightCategory =
  | "inventory"
  | "orders"
  | "products"
  | "health"
  | "onboarding";

export type StoreInsight = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
};

export type StoreInsightsResult = {
  insights: StoreInsight[];
};

export type StoreInsightsInput = {
  metrics: StoreMetrics;
  onboarding: OnboardingStatusResponse | null;
  healthScore: StoreHealthScore;
};

const RULE_ORDER: Record<string, number> = {
  "inventory-out-of-stock": 1,
  "inventory-low-stock": 2,
  "products-not-synced": 3,
  "orders-not-imported": 4,
  "health-below-target": 5,
  "onboarding-in-progress": 6,
  "orders-sync-blocked": 7,
};

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const EMPTY_RESULT: StoreInsightsResult = {
  insights: [],
};

function productCountLabel(count: number): string {
  const value = formatMetricNumber(count);
  return count === 1 ? "1 product" : `${value} products`;
}

export function sortStoreInsights(insights: StoreInsight[]): StoreInsight[] {
  return [...insights].sort((left, right) => {
    const severityDiff =
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return (RULE_ORDER[left.id] ?? 0) - (RULE_ORDER[right.id] ?? 0);
  });
}

export function getInsightBadgeTone(
  severity: InsightSeverity,
): "critical" | "warning" | "info" | undefined {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    case "info":
      return "info";
    default:
      return undefined;
  }
}

export function buildStoreInsights(
  input: StoreInsightsInput,
): StoreInsightsResult {
  const insights: StoreInsight[] = [];
  const { metrics, onboarding, healthScore } = input;

  if (metrics.outOfStockProducts > 0) {
    insights.push({
      id: "inventory-out-of-stock",
      category: "inventory",
      severity: "critical",
      title: "Products are out of stock",
      description: `${productCountLabel(metrics.outOfStockProducts)} currently have zero inventory.`,
    });
  }

  if (metrics.lowStockProducts > 0) {
    insights.push({
      id: "inventory-low-stock",
      category: "inventory",
      severity: "warning",
      title: "Low inventory detected",
      description: `${productCountLabel(metrics.lowStockProducts)} are running low on inventory.`,
    });
  }

  if (metrics.products === 0) {
    insights.push({
      id: "products-not-synced",
      category: "products",
      severity: "critical",
      title: "No products synced",
      description: "StorePilot has not imported any products yet.",
    });
  }

  if (metrics.orders === 0) {
    insights.push({
      id: "orders-not-imported",
      category: "orders",
      severity: "warning",
      title: "No orders imported",
      description: "No orders have been imported into StorePilot.",
    });
  }

  if (healthScore.score < 70) {
    insights.push({
      id: "health-below-target",
      category: "health",
      severity: "warning",
      title: "Store health requires attention",
      description: "Store health score is currently below target.",
    });
  }

  if (onboarding !== null && onboarding.status !== "completed") {
    insights.push({
      id: "onboarding-in-progress",
      category: "onboarding",
      severity: "info",
      title: "Store setup in progress",
      description: "StorePilot is still syncing your store data.",
    });
  }

  if (onboarding?.ordersSyncStatus === "blocked") {
    insights.push({
      id: "orders-sync-blocked",
      category: "onboarding",
      severity: "info",
      title: "Orders sync waiting for Shopify approval",
      description:
        "Products and inventory are already available while order access is pending.",
    });
  }

  return {
    insights: sortStoreInsights(insights),
  };
}

export function serializeInsightsForLoader(
  result: StoreInsightsResult,
): StoreInsightsResult {
  return {
    insights: result.insights.map((item) => ({ ...item })),
  };
}

export async function getStoreInsights(
  storeId: string,
): Promise<StoreInsightsResult> {
  if (!storeId) {
    return { ...EMPTY_RESULT };
  }

  try {
    const [metrics, onboarding] = await Promise.all([
      getStoreMetrics(storeId),
      getOnboardingStatus(storeId),
    ]);
    const healthScore = calculateStoreHealthScore(metrics);

    return serializeInsightsForLoader(
      buildStoreInsights({ metrics, onboarding, healthScore }),
    );
  } catch {
    return { ...EMPTY_RESULT };
  }
}
