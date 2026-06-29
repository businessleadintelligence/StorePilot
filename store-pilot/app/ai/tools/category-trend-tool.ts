import type { TrendDirection } from "./trend-detection-tool";
import { calculateGrowthRate } from "./growth-rate-tool";
import { calculateMomentum } from "./momentum-tool";

export type CategoryTrendEntry = {
  category: string;
  direction: TrendDirection;
  growthRate: number;
  momentum: number;
  productCount: number;
  sales30Days: number;
};

export function inferProductCategory(title: string): string {
  const normalized = title.trim().toLowerCase();
  const firstWord = normalized.split(/\s+/)[0] ?? "general";
  if (firstWord.length < 3) return "General";
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

export function buildCategoryTrends(
  products: Array<{
    title: string;
    sales7Days: number;
    sales30Days: number;
    velocity: number;
    direction: TrendDirection;
  }>,
): CategoryTrendEntry[] {
  const buckets = new Map<
    string,
    { sales7Days: number; sales30Days: number; velocity: number; count: number; directions: TrendDirection[] }
  >();

  for (const product of products) {
    const category = inferProductCategory(product.title);
    const bucket = buckets.get(category) ?? {
      sales7Days: 0,
      sales30Days: 0,
      velocity: 0,
      count: 0,
      directions: [],
    };
    bucket.sales7Days += product.sales7Days;
    bucket.sales30Days += product.sales30Days;
    bucket.velocity += product.velocity;
    bucket.count += 1;
    bucket.directions.push(product.direction);
    buckets.set(category, bucket);
  }

  return [...buckets.entries()].map(([category, bucket]) => {
    const emergingCount = bucket.directions.filter((direction) => direction === "emerging").length;
    const decliningCount = bucket.directions.filter((direction) => direction === "declining").length;
    const direction: TrendDirection =
      emergingCount > decliningCount ? "emerging" : decliningCount > emergingCount ? "declining" : "stable";
    const growthRate = calculateGrowthRate({
      currentPeriod: bucket.sales7Days,
      priorPeriod: Math.max(1, bucket.sales30Days - bucket.sales7Days),
    });

    return {
      category,
      direction,
      growthRate,
      momentum: calculateMomentum({
        sales7Days: bucket.sales7Days,
        sales30Days: bucket.sales30Days,
        velocity: bucket.velocity / Math.max(1, bucket.count),
      }),
      productCount: bucket.count,
      sales30Days: bucket.sales30Days,
    };
  });
}
