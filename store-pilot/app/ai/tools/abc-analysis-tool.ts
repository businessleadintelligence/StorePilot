export type AbcClass = "A" | "B" | "C";

export type AbcProduct = {
  productId: string;
  title: string;
  revenueContribution: number;
  abcClass: AbcClass;
};

export function classifyAbcBand(cumulativeShare: number): AbcClass {
  if (cumulativeShare <= 0.8) {
    return "A";
  }

  if (cumulativeShare <= 0.95) {
    return "B";
  }

  return "C";
}

export function buildAbcAnalysis(
  products: Array<{ productId: string; title: string; sales30Days: number; unitCost: number | null }>,
): {
  products: AbcProduct[];
  distribution: Array<{ label: AbcClass; value: number }>;
} {
  const ranked = [...products]
    .map((product) => ({
      productId: product.productId,
      title: product.title,
      revenueContribution: product.sales30Days * (product.unitCost ?? 1),
    }))
    .sort((left, right) => right.revenueContribution - left.revenueContribution);

  const totalRevenue = ranked.reduce((total, product) => total + product.revenueContribution, 0) || 1;
  let cumulative = 0;

  const analyzed: AbcProduct[] = ranked.map((product) => {
    cumulative += product.revenueContribution / totalRevenue;
    return {
      ...product,
      abcClass: classifyAbcBand(cumulative),
    };
  });

  const distribution: Array<{ label: AbcClass; value: number }> = ["A", "B", "C"].map((label) => ({
    label: label as AbcClass,
    value: analyzed.filter((product) => product.abcClass === label).length,
  }));

  return { products: analyzed, distribution };
}
