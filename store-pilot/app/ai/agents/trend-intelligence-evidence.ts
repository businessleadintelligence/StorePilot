import type { TrendFacts } from "../facts/trend-facts";

export type TrendEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
};

export function buildTrendEvidenceCatalog(facts: TrendFacts): TrendEvidenceCatalogEntry[] {
  const entries: TrendEvidenceCatalogEntry[] = [
    {
      key: "trend_health_score",
      label: "Trend health score",
      value: `${facts.trendHealthScore}/100`,
      factPath: "trendHealthScore",
    },
    {
      key: "trend_score",
      label: "Trend score",
      value: `${facts.trendScore}/100`,
      factPath: "trendScore",
    },
    {
      key: "trend_direction",
      label: "Store trend direction",
      value: facts.trendDirection,
      factPath: "trendDirection",
    },
    {
      key: "store_growth_rate",
      label: "Store growth rate",
      value: `${facts.rollingGrowth.storeGrowthRate}%`,
      factPath: "rollingGrowth.storeGrowthRate",
    },
    {
      key: "declining_product_count",
      label: "Declining products",
      value: `${facts.rollingDecline.decliningProductCount}`,
      factPath: "rollingDecline.decliningProductCount",
    },
    {
      key: "emerging_product_count",
      label: "Emerging products",
      value: `${facts.momentum.emergingCount}`,
      factPath: "momentum.emergingCount",
    },
    {
      key: "average_momentum",
      label: "Average momentum",
      value: `${facts.momentum.averageMomentum}`,
      factPath: "momentum.averageMomentum",
    },
    {
      key: "revenue_30_days",
      label: "30-day revenue",
      value: `${facts.revenueTrend.revenue30Days}`,
      factPath: "revenueTrend.revenue30Days",
    },
    {
      key: "risk_level",
      label: "Trend risk level",
      value: facts.riskLevel,
      factPath: "riskLevel",
    },
    {
      key: "opportunity_level",
      label: "Opportunity level",
      value: facts.opportunityLevel,
      factPath: "opportunityLevel",
    },
  ];

  for (const product of facts.products.filter((entry) => entry.direction === "emerging").slice(0, 6)) {
    entries.push({
      key: `product_${product.productId}_momentum`,
      label: `${product.title} momentum`,
      value: `${product.momentum}`,
      factPath: `products.${product.productId}.momentum`,
    });
  }

  for (const category of facts.categoryTrend.slice(0, 4)) {
    entries.push({
      key: `category_${category.category.toLowerCase()}_growth`,
      label: `${category.category} growth`,
      value: `${category.growthRate}%`,
      factPath: `categoryTrend.${category.category}.growthRate`,
    });
  }

  return entries;
}

export function resolveTrendEvidenceFromKeys(
  keys: string[],
  catalog: TrendEvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) throw new Error(`invalid_evidence_key:${key}`);
    return `${entry.label}: ${entry.value}`;
  });
}

export function validateTrendEvidenceKeys(keys: string[], catalog: TrendEvidenceCatalogEntry[]): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  for (const key of keys) {
    if (!catalogMap.has(key)) throw new Error(`invalid_evidence_key:${key}`);
  }
}
