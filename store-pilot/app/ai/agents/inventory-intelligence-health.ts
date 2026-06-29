import type { InventoryFacts } from "../facts/inventory-facts";
import type { InventoryHealthExplanation } from "../schemas/inventory-intelligence";

export function buildInventoryHealthExplanation(facts: InventoryFacts): InventoryHealthExplanation {
  const drivers: InventoryHealthExplanation["drivers"] = [];

  if (facts.stockoutAlertCount > 0) {
    drivers.push({
      factor: "Stockout risk",
      direction: "negative",
      detail: `${facts.stockoutAlertCount} SKUs are at elevated stockout risk.`,
    });
  }

  if (facts.deadStockCount > 0) {
    drivers.push({
      factor: "Dead inventory",
      direction: "negative",
      detail: `${facts.deadStockCount} SKUs show dead or stale inventory patterns.`,
    });
  }

  if (facts.overstockCount > 0) {
    drivers.push({
      factor: "Overstock",
      direction: "negative",
      detail: `${facts.overstockCount} SKUs carry excessive coverage relative to velocity.`,
    });
  }

  if (facts.averageDaysRemaining !== null && facts.averageDaysRemaining >= 30) {
    drivers.push({
      factor: "Coverage",
      direction: "positive",
      detail: `Average inventory coverage is ${facts.averageDaysRemaining} days.`,
    });
  }

  if (facts.averageTurnover >= 1) {
    drivers.push({
      factor: "Turnover",
      direction: "positive",
      detail: `Average turnover is ${facts.averageTurnover}.`,
    });
  }

  const negativeCount = drivers.filter((driver) => driver.direction === "negative").length;
  const summary =
    negativeCount >= 2
      ? "Inventory health is pressured by stockout, dead stock, or overstock signals."
      : negativeCount === 0
        ? "Inventory health is supported by stable coverage and turnover signals."
        : "Inventory health reflects mixed operational signals across the catalog.";

  return {
    score: facts.inventoryHealthScore,
    summary,
    drivers,
  };
}
