import { getStoreMetrics, type StoreMetrics } from "./metrics.server";

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export type StoreHealthScore = {
  score: number;
  grade: HealthGrade;
  productsScore: number;
  inventoryScore: number;
  ordersScore: number;
  issues: string[];
};

const PRODUCTS_SCORE_MAX = 30;
const INVENTORY_SCORE_MAX = 30;
const ORDERS_SCORE_MAX = 40;
const HEALTH_SCORE_MAX = 100;

export function calculateProductsScore(productCount: number): number {
  const count = Math.max(0, productCount);

  if (count === 0) {
    return 0;
  }

  if (count <= 10) {
    return 10;
  }

  if (count <= 50) {
    return 20;
  }

  return PRODUCTS_SCORE_MAX;
}

export function calculateInventoryScore(
  lowStockProducts: number,
  outOfStockProducts: number,
): number {
  const lowStockPenalty = Math.max(0, lowStockProducts) * 2;
  const outOfStockPenalty = Math.max(0, outOfStockProducts) * 5;
  const score = INVENTORY_SCORE_MAX - lowStockPenalty - outOfStockPenalty;

  return Math.max(0, Math.min(INVENTORY_SCORE_MAX, score));
}

export function calculateOrdersScore(orderCount: number): number {
  const count = Math.max(0, orderCount);

  if (count === 0) {
    return 0;
  }

  if (count <= 10) {
    return 10;
  }

  if (count <= 50) {
    return 20;
  }

  if (count <= 100) {
    return 30;
  }

  return ORDERS_SCORE_MAX;
}

export function calculateHealthGrade(score: number): HealthGrade {
  const clampedScore = clampHealthScore(score);

  if (clampedScore >= 90) {
    return "A";
  }

  if (clampedScore >= 80) {
    return "B";
  }

  if (clampedScore >= 70) {
    return "C";
  }

  if (clampedScore >= 60) {
    return "D";
  }

  return "F";
}

export function clampHealthScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(HEALTH_SCORE_MAX, Math.round(score)));
}

export function buildHealthIssues(metrics: StoreMetrics): string[] {
  const issues: string[] = [];

  if (metrics.products === 0) {
    issues.push("No products synced");
  }

  if (metrics.lowStockProducts > 0) {
    issues.push(
      metrics.lowStockProducts === 1
        ? "1 product is low stock"
        : `${metrics.lowStockProducts} products are low stock`,
    );
  }

  if (metrics.outOfStockProducts > 0) {
    issues.push(
      metrics.outOfStockProducts === 1
        ? "1 product is out of stock"
        : `${metrics.outOfStockProducts} products are out of stock`,
    );
  }

  if (metrics.orders === 0) {
    issues.push("No orders have been synced");
  }

  return issues;
}

export function calculateStoreHealthScore(
  metrics: StoreMetrics,
): StoreHealthScore {
  const productsScore = calculateProductsScore(metrics.products);
  const inventoryScore = calculateInventoryScore(
    metrics.lowStockProducts,
    metrics.outOfStockProducts,
  );
  const ordersScore = calculateOrdersScore(metrics.orders);
  const score = clampHealthScore(
    productsScore + inventoryScore + ordersScore,
  );

  return {
    score,
    grade: calculateHealthGrade(score),
    productsScore,
    inventoryScore,
    ordersScore,
    issues: buildHealthIssues(metrics),
  };
}

export function serializeHealthScoreForLoader(
  healthScore: StoreHealthScore,
): StoreHealthScore {
  return {
    score: clampHealthScore(healthScore.score),
    grade: healthScore.grade,
    productsScore: Math.max(0, Math.min(PRODUCTS_SCORE_MAX, healthScore.productsScore)),
    inventoryScore: Math.max(
      0,
      Math.min(INVENTORY_SCORE_MAX, healthScore.inventoryScore),
    ),
    ordersScore: Math.max(0, Math.min(ORDERS_SCORE_MAX, healthScore.ordersScore)),
    issues: [...healthScore.issues],
  };
}

export async function getStoreHealthScore(
  storeId: string,
): Promise<StoreHealthScore> {
  const metrics = await getStoreMetrics(storeId);
  return serializeHealthScoreForLoader(calculateStoreHealthScore(metrics));
}

export function getGradeBadgeTone(
  grade: HealthGrade,
): "success" | "info" | "warning" | "critical" | undefined {
  switch (grade) {
    case "A":
    case "B":
      return "success";
    case "C":
      return "info";
    case "D":
      return "warning";
    case "F":
      return "critical";
    default:
      return undefined;
  }
}
