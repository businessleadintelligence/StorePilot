import {
  calculateStoreHealthScore,
  type StoreHealthScore,
} from "./health-score.server";
import { formatMetricNumber, getStoreMetrics, type StoreMetrics } from "./metrics.server";
import {
  getOnboardingStatus,
  type OnboardingStatusResponse,
} from "./onboarding-ui.server";

export type RecommendationSeverity = "critical" | "warning" | "info";

export type RecommendationCategory =
  | "inventory"
  | "orders"
  | "products"
  | "setup"
  | "health";

export type StoreRecommendation = {
  id: string;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  category: RecommendationCategory;
};

export type StoreRecommendationsResult = {
  recommendations: StoreRecommendation[];
  critical: number;
  warning: number;
  info: number;
};

export type StoreRecommendationsInput = {
  metrics: StoreMetrics;
  onboarding: OnboardingStatusResponse | null;
  healthScore: StoreHealthScore;
};

const RULE_ORDER: Record<string, number> = {
  "inventory-out-of-stock": 1,
  "inventory-low-stock": 2,
  "products-not-synced": 3,
  "orders-not-imported": 4,
  "setup-in-progress": 5,
  "orders-sync-blocked": 6,
  "health-below-target": 7,
};

const SEVERITY_RANK: Record<RecommendationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const EMPTY_RESULT: StoreRecommendationsResult = {
  recommendations: [],
  critical: 0,
  warning: 0,
  info: 0,
};

function productCountLabel(count: number): string {
  const value = formatMetricNumber(count);
  return count === 1 ? "1 product" : `${value} products`;
}

export function sortStoreRecommendations(
  recommendations: StoreRecommendation[],
): StoreRecommendation[] {
  return [...recommendations].sort((left, right) => {
    const severityDiff =
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return (RULE_ORDER[left.id] ?? 0) - (RULE_ORDER[right.id] ?? 0);
  });
}

export function countRecommendationsBySeverity(
  recommendations: StoreRecommendation[],
): Pick<StoreRecommendationsResult, "critical" | "warning" | "info"> {
  return {
    critical: recommendations.filter((item) => item.severity === "critical")
      .length,
    warning: recommendations.filter((item) => item.severity === "warning")
      .length,
    info: recommendations.filter((item) => item.severity === "info").length,
  };
}

export function getRecommendationBadgeTone(
  severity: RecommendationSeverity,
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

export function buildStoreRecommendations(
  input: StoreRecommendationsInput,
): StoreRecommendationsResult {
  const recommendations: StoreRecommendation[] = [];
  const { metrics, onboarding, healthScore } = input;

  if (metrics.outOfStockProducts > 0) {
    recommendations.push({
      id: "inventory-out-of-stock",
      severity: "critical",
      title: "Products are out of stock",
      description: `${productCountLabel(metrics.outOfStockProducts)} currently have zero inventory.`,
      category: "inventory",
    });
  }

  if (metrics.lowStockProducts > 0) {
    recommendations.push({
      id: "inventory-low-stock",
      severity: "warning",
      title: "Low inventory detected",
      description: `${productCountLabel(metrics.lowStockProducts)} are running low on inventory.`,
      category: "inventory",
    });
  }

  if (metrics.products === 0) {
    recommendations.push({
      id: "products-not-synced",
      severity: "critical",
      title: "No products synced",
      description: "StorePilot has not imported any products yet.",
      category: "products",
    });
  }

  if (metrics.orders === 0) {
    recommendations.push({
      id: "orders-not-imported",
      severity: "warning",
      title: "No orders imported",
      description: "No orders have been imported into StorePilot.",
      category: "orders",
    });
  }

  if (onboarding !== null && onboarding.status !== "completed") {
    recommendations.push({
      id: "setup-in-progress",
      severity: "info",
      title: "Store setup in progress",
      description: "StorePilot is still syncing your store data.",
      category: "setup",
    });
  }

  if (onboarding?.ordersSyncStatus === "blocked") {
    recommendations.push({
      id: "orders-sync-blocked",
      severity: "info",
      title: "Orders sync waiting for Shopify approval",
      description:
        "Products and inventory are already available while order access is pending.",
      category: "orders",
    });
  }

  if (healthScore.score < 70) {
    recommendations.push({
      id: "health-below-target",
      severity: "warning",
      title: "Store health requires attention",
      description: "Store health score is currently below target.",
      category: "health",
    });
  }

  const sorted = sortStoreRecommendations(recommendations);

  return {
    recommendations: sorted,
    ...countRecommendationsBySeverity(sorted),
  };
}

export function serializeRecommendationsForLoader(
  result: StoreRecommendationsResult,
): StoreRecommendationsResult {
  const recommendations = result.recommendations.map((item) => ({ ...item }));

  return {
    recommendations,
    ...countRecommendationsBySeverity(recommendations),
  };
}

export async function getStoreRecommendations(
  storeId: string,
): Promise<StoreRecommendationsResult> {
  try {
    const [metrics, onboarding] = await Promise.all([
      getStoreMetrics(storeId),
      getOnboardingStatus(storeId),
    ]);
    const healthScore = calculateStoreHealthScore(metrics);

    return serializeRecommendationsForLoader(
      buildStoreRecommendations({ metrics, onboarding, healthScore }),
    );
  } catch {
    return { ...EMPTY_RESULT, recommendations: [] };
  }
}
