export function calculateTrendScore(input: {
  emergingProductCount: number;
  decliningProductCount: number;
  storeGrowthRate: number;
  averageMomentum: number;
  totalProducts: number;
}): number {
  if (input.totalProducts === 0) {
    return 0;
  }

  let score = 50;
  score += Math.min(25, input.emergingProductCount * 4);
  score -= Math.min(20, input.decliningProductCount * 3);
  score += Math.round(Math.max(-10, Math.min(15, input.storeGrowthRate)));
  score += Math.round(input.averageMomentum * 10);

  return Math.max(0, Math.min(100, score));
}
