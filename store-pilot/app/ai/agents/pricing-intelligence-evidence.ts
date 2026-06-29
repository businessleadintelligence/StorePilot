import type { PricingIntelligenceFacts } from "../facts/pricing-intelligence-facts";

export type PricingIntelligenceEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
  section: string;
};

export function buildPricingIntelligenceEvidenceCatalog(
  facts: PricingIntelligenceFacts,
): PricingIntelligenceEvidenceCatalogEntry[] {
  const entries: PricingIntelligenceEvidenceCatalogEntry[] = [
    {
      key: "pricing_health_score",
      label: "Pricing health score",
      value: `${facts.pricingHealthScore}/100`,
      factPath: "pricingHealthScore",
      section: "Overview",
    },
    {
      key: "margin_percent",
      label: "Margin percent",
      value: `${facts.scores.marginPercent}%`,
      factPath: "scores.marginPercent",
      section: "Margin Protection",
    },
    {
      key: "average_discount_percent",
      label: "Average discount percent",
      value: `${facts.scores.averageDiscountPercent}%`,
      factPath: "scores.averageDiscountPercent",
      section: "Discount Optimization",
    },
    {
      key: "discount_frequency",
      label: "Discount frequency",
      value: `${facts.scores.discountFrequency}%`,
      factPath: "scores.discountFrequency",
      section: "Discount Optimization",
    },
    {
      key: "discount_dependence",
      label: "Discount dependence",
      value: `${facts.scores.discountDependence}%`,
      factPath: "scores.discountDependence",
      section: "Discount Optimization",
    },
    {
      key: "aov",
      label: "Average order value",
      value: `$${facts.scores.aov}`,
      factPath: "scores.aov",
      section: "Revenue Optimization",
    },
    {
      key: "conversion_rate",
      label: "Conversion rate proxy",
      value: `${facts.scores.conversionRate}`,
      factPath: "scores.conversionRate",
      section: "Conversion Pricing",
    },
    {
      key: "revenue_30",
      label: "30-day revenue",
      value: `$${facts.storeTotals.totalRevenue30}`,
      factPath: "storeTotals.totalRevenue30",
      section: "Revenue Optimization",
    },
    {
      key: "gross_profit",
      label: "Gross profit proxy",
      value: `$${facts.scores.grossProfit}`,
      factPath: "scores.grossProfit",
      section: "Margin Protection",
    },
    {
      key: "price_consistency_score",
      label: "Price consistency score",
      value: `${facts.scores.priceConsistencyScore}/100`,
      factPath: "scores.priceConsistencyScore",
      section: "Price Consistency",
    },
    {
      key: "premium_opportunity",
      label: "Premium pricing opportunity",
      value: `${facts.scores.premiumPricingOpportunity}/100`,
      factPath: "scores.premiumPricingOpportunity",
      section: "Premium Pricing",
    },
    {
      key: "bundle_opportunity",
      label: "Bundle pricing opportunity",
      value: `${facts.scores.bundlePriceOpportunity}/100`,
      factPath: "scores.bundlePriceOpportunity",
      section: "Bundle Pricing",
    },
    {
      key: "inventory_risk",
      label: "Inventory pricing risk",
      value: `${facts.scores.inventoryRisk}/100`,
      factPath: "scores.inventoryRisk",
      section: "Inventory Pricing",
    },
    {
      key: "revenue_opportunity",
      label: "Revenue opportunity",
      value: `${facts.revenueOpportunity}`,
      factPath: "revenueOpportunity",
      section: "Overview",
    },
    {
      key: "profit_opportunity",
      label: "Profit opportunity",
      value: `${facts.profitOpportunity}`,
      factPath: "profitOpportunity",
      section: "Overview",
    },
    {
      key: "premium_candidates",
      label: "Premium positioning candidates",
      value: `${facts.strategySignals.premiumCandidates}`,
      factPath: "strategySignals.premiumCandidates",
      section: "Premium Pricing",
    },
    {
      key: "never_discount_candidates",
      label: "Never-discount candidates",
      value: `${facts.strategySignals.neverDiscountCandidates}`,
      factPath: "strategySignals.neverDiscountCandidates",
      section: "Discount Optimization",
    },
    {
      key: "price_sensitive_products",
      label: "Price-sensitive products",
      value: `${facts.strategySignals.priceSensitiveProducts}`,
      factPath: "strategySignals.priceSensitiveProducts",
      section: "Conversion Pricing",
    },
    {
      key: "critical_issue_count",
      label: "Critical issue count",
      value: `${facts.criticalIssueCount}`,
      factPath: "criticalIssueCount",
      section: "Overview",
    },
  ];

  for (const issue of facts.discount.issues.slice(0, 4)) {
    entries.push({
      key: `discount_issue_${issue}`,
      label: "Discount issue",
      value: issue,
      factPath: `discount.issues.${issue}`,
      section: "Discount Optimization",
    });
  }

  return entries;
}

export function resolvePricingIntelligenceEvidenceFromKeys(
  keys: string[],
  catalog: PricingIntelligenceEvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) throw new Error(`invalid_evidence_key:${key}`);
    return `${entry.label}: ${entry.value}`;
  });
}

export function validatePricingIntelligenceEvidenceKeys(
  keys: string[],
  catalog: PricingIntelligenceEvidenceCatalogEntry[],
): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  for (const key of keys) {
    if (!catalogMap.has(key)) throw new Error(`invalid_evidence_key:${key}`);
  }
}
