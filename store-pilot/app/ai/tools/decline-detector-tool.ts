import type { TrendDirection } from "./trend-detection-tool";

export function detectDecliningProducts<T extends { productId: string; direction: TrendDirection }>(
  products: T[],
): T[] {
  return products.filter((product) => product.direction === "declining");
}

export function calculateDeclineRate(input: {
  decliningProductCount: number;
  totalProducts: number;
}): number {
  if (input.totalProducts === 0) return 0;
  return Number(((input.decliningProductCount / input.totalProducts) * 100).toFixed(2));
}
