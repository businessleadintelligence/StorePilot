import type { InventoryFacts } from "../facts/inventory-facts";

export type InventoryEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
};

export function buildInventoryEvidenceCatalog(facts: InventoryFacts): InventoryEvidenceCatalogEntry[] {
  const entries: InventoryEvidenceCatalogEntry[] = [
    {
      key: "inventory_health_score",
      label: "Inventory health score",
      value: `${facts.inventoryHealthScore}/100`,
      factPath: "inventoryHealthScore",
    },
    {
      key: "total_products",
      label: "Tracked products",
      value: `${facts.totalProducts}`,
      factPath: "totalProducts",
    },
    {
      key: "total_inventory_units",
      label: "Total inventory units",
      value: `${facts.totalInventoryUnits}`,
      factPath: "totalInventoryUnits",
    },
    {
      key: "stockout_alerts",
      label: "Stockout alerts",
      value: `${facts.stockoutAlertCount}`,
      factPath: "stockoutAlertCount",
    },
    {
      key: "dead_stock_count",
      label: "Dead stock SKUs",
      value: `${facts.deadStockCount}`,
      factPath: "deadStockCount",
    },
    {
      key: "overstock_count",
      label: "Overstock SKUs",
      value: `${facts.overstockCount}`,
      factPath: "overstockCount",
    },
    {
      key: "understock_count",
      label: "Understock SKUs",
      value: `${facts.understockCount}`,
      factPath: "understockCount",
    },
    {
      key: "average_days_remaining",
      label: "Average days remaining",
      value:
        facts.averageDaysRemaining === null
          ? "Unknown coverage"
          : `${facts.averageDaysRemaining} days`,
      factPath: "averageDaysRemaining",
    },
    {
      key: "average_turnover",
      label: "Average turnover",
      value: `${facts.averageTurnover}`,
      factPath: "averageTurnover",
    },
    {
      key: "average_weeks_of_cover",
      label: "Average weeks of cover",
      value:
        facts.averageWeeksOfCover === null
          ? "Unknown coverage"
          : `${facts.averageWeeksOfCover} weeks`,
      factPath: "averageWeeksOfCover",
    },
    {
      key: "average_sell_through_rate",
      label: "Average sell-through rate",
      value: `${facts.averageSellThroughRate}`,
      factPath: "averageSellThroughRate",
    },
    {
      key: "capital_locked_in_inventory",
      label: "Capital locked in inventory",
      value: `${facts.capitalLockedInInventory.toLocaleString()}`,
      factPath: "capitalLockedInInventory",
    },
    {
      key: "fast_mover_count",
      label: "Fast movers",
      value: `${facts.fastMoverCount}`,
      factPath: "fastMoverCount",
    },
    {
      key: "slow_mover_count",
      label: "Slow movers",
      value: `${facts.slowMoverCount}`,
      factPath: "slowMoverCount",
    },
    {
      key: "abc_class_a_count",
      label: "ABC class A SKUs",
      value: `${facts.abcDistribution.find((item) => item.label === "A")?.value ?? 0}`,
      factPath: "abcDistribution.A",
    },
    {
      key: "xyz_class_x_count",
      label: "XYZ class X SKUs",
      value: `${facts.xyzDistribution.find((item) => item.label === "X")?.value ?? 0}`,
      factPath: "xyzDistribution.X",
    },
  ];

  for (const product of facts.products.slice(0, 12)) {
    entries.push(
      {
        key: `product_${product.productId}_velocity`,
        label: `${product.title} velocity`,
        value: `${product.velocity} units/day`,
        factPath: `products.${product.productId}.velocity`,
      },
      {
        key: `product_${product.productId}_days_remaining`,
        label: `${product.title} days remaining`,
        value:
          product.daysRemaining === null ? "Unknown" : `${product.daysRemaining} days`,
        factPath: `products.${product.productId}.daysRemaining`,
      },
      {
        key: `product_${product.productId}_stock_risk`,
        label: `${product.title} stock risk`,
        value: product.stockRisk,
        factPath: `products.${product.productId}.stockRisk`,
      },
      {
        key: `product_${product.productId}_aging`,
        label: `${product.title} aging`,
        value: `${product.agingDays} days`,
        factPath: `products.${product.productId}.agingDays`,
      },
    );
  }

  return entries;
}

export function resolveInventoryEvidenceFromKeys(
  keys: string[],
  catalog: InventoryEvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) {
      throw new Error(`invalid_evidence_key:${key}`);
    }

    return `${entry.label}: ${entry.value}`;
  });
}

export function validateInventoryEvidenceKeys(
  keys: string[],
  catalog: InventoryEvidenceCatalogEntry[],
): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  for (const key of keys) {
    if (!catalogMap.has(key)) {
      throw new Error(`invalid_evidence_key:${key}`);
    }
  }
}
