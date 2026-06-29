import type { ProductFacts } from "../facts/product-facts";

export type EvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
};

export function buildEvidenceCatalog(facts: ProductFacts): EvidenceCatalogEntry[] {
  const trendPercent =
    facts.sales30Days > 0
      ? Math.round(((facts.sales7Days * (30 / 7) - facts.sales30Days) / facts.sales30Days) * 100)
      : 0;

  return [
    {
      key: "sales_velocity",
      label: "Sales velocity",
      value: `${facts.velocity.toFixed(2)} units/day`,
      factPath: "velocity",
    },
    {
      key: "sales_7d",
      label: "7 day sales",
      value: `${facts.sales7Days} units`,
      factPath: "sales7Days",
    },
    {
      key: "sales_30d",
      label: "30 day sales",
      value: `${facts.sales30Days} units`,
      factPath: "sales30Days",
    },
    {
      key: "sales_90d",
      label: "90 day sales",
      value: `${facts.sales90Days} units`,
      factPath: "sales90Days",
    },
    {
      key: "sales_trend",
      label: "Sales trend",
      value: `${facts.trend}${trendPercent !== 0 ? ` (${trendPercent > 0 ? "+" : ""}${trendPercent}% vs 30d baseline)` : ""}`,
      factPath: "trend",
    },
    {
      key: "revenue_30d",
      label: "30 day revenue",
      value: `$${facts.revenue30Days.toFixed(2)}`,
      factPath: "revenue30Days",
    },
    {
      key: "inventory_available",
      label: "Available inventory",
      value:
        facts.availableInventory === null ? "Not tracked" : `${facts.availableInventory} units`,
      factPath: "availableInventory",
    },
    {
      key: "inventory_days",
      label: "Inventory coverage",
      value:
        facts.daysRemaining === null ? "Unknown days remaining" : `${facts.daysRemaining} days`,
      factPath: "daysRemaining",
    },
    {
      key: "stock_risk",
      label: "Stock risk",
      value: facts.stockRisk,
      factPath: "stockRisk",
    },
    {
      key: "refund_rate",
      label: "Refund rate",
      value: `${facts.refundRate.toFixed(1)}%`,
      factPath: "refundRate",
    },
    {
      key: "refund_count_30d",
      label: "30 day refunds",
      value: `${facts.refundCount30Days} orders`,
      factPath: "refundCount30Days",
    },
    {
      key: "margin",
      label: "Margin",
      value: facts.margin === null ? "Unknown margin" : `${facts.margin.toFixed(1)}%`,
      factPath: "margin",
    },
    {
      key: "health_score",
      label: "Health score",
      value: `${facts.healthScore}/100`,
      factPath: "healthScore",
    },
    {
      key: "orders_30d",
      label: "30 day orders",
      value: `${facts.orders30Days} orders`,
      factPath: "orders30Days",
    },
    {
      key: "product_status",
      label: "Product status",
      value: facts.status,
      factPath: "status",
    },
  ];
}

export function resolveEvidenceFromKeys(
  keys: string[],
  catalog: EvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) {
      throw new Error(`unknown_evidence_key:${key}`);
    }

    return `${entry.label}: ${entry.value}`;
  });
}

export function validateEvidenceKeys(keys: string[], catalog: EvidenceCatalogEntry[]): void {
  const allowed = new Set(catalog.map((entry) => entry.key));

  for (const key of keys) {
    if (!allowed.has(key)) {
      throw new Error(`invalid_evidence_key:${key}`);
    }
  }
}
