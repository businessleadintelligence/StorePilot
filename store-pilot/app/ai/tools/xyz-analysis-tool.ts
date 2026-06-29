export type XyzClass = "X" | "Y" | "Z";

export function calculateDemandCoefficientOfVariation(dailyQuantities: number[]): number {
  if (dailyQuantities.length === 0) {
    return 0;
  }

  const average = dailyQuantities.reduce((total, value) => total + value, 0) / dailyQuantities.length;
  if (average <= 0) {
    return 1;
  }

  const variance =
    dailyQuantities.reduce((total, value) => total + (value - average) ** 2, 0) /
    dailyQuantities.length;
  return Number((Math.sqrt(variance) / average).toFixed(2));
}

export function classifyXyzBand(coefficientOfVariation: number): XyzClass {
  if (coefficientOfVariation <= 0.3) {
    return "X";
  }

  if (coefficientOfVariation <= 0.7) {
    return "Y";
  }

  return "Z";
}

export function buildXyzAnalysis(
  products: Array<{ productId: string; title: string; dailyQuantities: number[] }>,
): {
  products: Array<{ productId: string; title: string; xyzClass: XyzClass; variability: number }>;
  distribution: Array<{ label: XyzClass; value: number }>;
} {
  const analyzed = products.map((product) => {
    const variability = calculateDemandCoefficientOfVariation(product.dailyQuantities);
    return {
      productId: product.productId,
      title: product.title,
      variability,
      xyzClass: classifyXyzBand(variability),
    };
  });

  const distribution: Array<{ label: XyzClass; value: number }> = ["X", "Y", "Z"].map((label) => ({
    label: label as XyzClass,
    value: analyzed.filter((product) => product.xyzClass === label).length,
  }));

  return { products: analyzed, distribution };
}
