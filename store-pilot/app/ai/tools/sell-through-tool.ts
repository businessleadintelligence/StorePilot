export function calculateSellThroughRate(input: {
  unitsSold: number;
  availableInventory: number | null;
}): number {
  const inventory = Math.max(0, input.availableInventory ?? 0);
  const denominator = input.unitsSold + inventory;
  if (denominator <= 0) {
    return 0;
  }

  return Number((input.unitsSold / denominator).toFixed(2));
}

export function classifySellThroughBand(rate: number): "fast" | "steady" | "slow" {
  if (rate >= 0.6) {
    return "fast";
  }

  if (rate >= 0.3) {
    return "steady";
  }

  return "slow";
}

export function calculateAverageSellThroughRate(
  products: Array<{ unitsSold: number; availableInventory: number | null }>,
): number {
  if (products.length === 0) {
    return 0;
  }

  const total = products.reduce(
    (sum, product) =>
      sum +
      calculateSellThroughRate({
        unitsSold: product.unitsSold,
        availableInventory: product.availableInventory,
      }),
    0,
  );

  return Number((total / products.length).toFixed(2));
}

export function identifyMoverProducts<T extends { productId: string; sellThroughRate: number }>(
  products: T[],
): { fastMovers: T[]; slowMovers: T[] } {
  return {
    fastMovers: products.filter((product) => product.sellThroughRate >= 0.6),
    slowMovers: products.filter((product) => product.sellThroughRate < 0.3),
  };
}
