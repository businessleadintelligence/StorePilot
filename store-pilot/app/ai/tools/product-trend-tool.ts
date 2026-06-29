import { detectTrendDirection, type TrendDirection } from "./trend-detection-tool";
import { calculateGrowthRate } from "./growth-rate-tool";
import { calculateMomentum } from "./momentum-tool";

export type ProductTrendEntry = {
  productId: string;
  title: string;
  direction: TrendDirection;
  growthRate: number;
  momentum: number;
  sales7Days: number;
  sales30Days: number;
  velocity: number;
};

export function buildProductTrend(input: {
  productId: string;
  title: string;
  sales7Days: number;
  sales30Days: number;
  salesPrior30Days: number;
  velocity: number;
}): ProductTrendEntry {
  const direction = detectTrendDirection({
    sales7Days: input.sales7Days,
    sales30Days: input.sales30Days,
  });

  return {
    productId: input.productId,
    title: input.title,
    direction,
    growthRate: calculateGrowthRate({
      currentPeriod: input.sales7Days,
      priorPeriod: Math.max(1, input.sales30Days - input.sales7Days),
    }),
    momentum: calculateMomentum({
      sales7Days: input.sales7Days,
      sales30Days: input.sales30Days,
      velocity: input.velocity,
    }),
    sales7Days: input.sales7Days,
    sales30Days: input.sales30Days,
    velocity: input.velocity,
  };
}

export function rankProductTrends(products: ProductTrendEntry[]): ProductTrendEntry[] {
  return [...products].sort(
    (left, right) => right.momentum - left.momentum || right.growthRate - left.growthRate,
  );
}
