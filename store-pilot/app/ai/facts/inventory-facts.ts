import { buildFactFingerprint } from "../cache/fingerprint";
import {
  buildInventoryMetrics,
  calculateSalesWindowMetrics,
} from "../tools";
import { buildAbcAnalysis } from "../tools/abc-analysis-tool";
import {
  calculateInventoryAgingDays,
  classifyDeadStock,
} from "../tools/inventory-aging-tool";
import {
  calculateInventoryHealthScore,
  isStockoutRisk,
} from "../tools/inventory-health-tool";
import {
  calculateInventoryRiskScore,
} from "../tools/inventory-risk-tool";
import {
  estimateLeadTimeDays,
} from "../tools/lead-time-tool";
import {
  calculateAverageSellThroughRate,
  calculateSellThroughRate,
  identifyMoverProducts,
} from "../tools/sell-through-tool";
import {
  calculateAverageWeeksOfCover,
  calculateWeeksOfCover,
} from "../tools/stock-coverage-tool";
import { buildXyzAnalysis } from "../tools/xyz-analysis-tool";
import {
  estimateInventoryRecommendationImpact,
} from "../tools/inventory-impact-tool";
import {
  calculateDaysOfInventoryRemaining,
  calculateInventoryTurnover,
  calculateInventoryVelocity,
} from "../tools/inventory-velocity-tool";
import {
  buildReorderSuggestion,
  calculateEstimatedRunOutDate,
  calculateReorderUrgency,
  calculateSafetyStock,
} from "../tools/reorder-tool";
import {
  calculateOverstockRisk,
  calculateUnderstockRisk,
  predictStockoutDate,
} from "../tools/stockout-risk-tool";
import type { UnifiedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import { getTrafficMetrics } from "../migration/unified-metrics-migration";
import type { StockRisk } from "../tools/inventory-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type InventoryProductFacts = {
  productId: string;
  title: string;
  sku: string | null;
  inventory: number | null;
  availableInventory: number | null;
  sales30Days: number;
  sales90Days: number;
  velocity: number;
  turnover: number;
  daysRemaining: number | null;
  weeksOfCover: number | null;
  agingDays: number;
  overstockRisk: boolean;
  understockRisk: boolean;
  stockRisk: StockRisk;
  stockoutPredictionDate: string | null;
  reorderUrgency: number;
  deadStock: boolean;
  safetyStock: number;
  runOutDate: string | null;
  unitCost: number | null;
  sellThroughRate: number;
  abcClass: "A" | "B" | "C";
  xyzClass: "X" | "Y" | "Z";
  inventoryRiskScore: number;
  leadTimeDays: number;
  capitalLocked: number;
};

export type InventoryFacts = {
  storeId: string;
  computedAt: string;
  inventoryHealthScore: number;
  totalProducts: number;
  totalInventoryUnits: number;
  deadStockCount: number;
  stockoutAlertCount: number;
  overstockCount: number;
  understockCount: number;
  averageDaysRemaining: number | null;
  averageWeeksOfCover: number | null;
  averageTurnover: number;
  averageSellThroughRate: number;
  capitalLockedInInventory: number;
  fastMoverCount: number;
  slowMoverCount: number;
  abcDistribution: Array<{ label: "A" | "B" | "C"; value: number }>;
  xyzDistribution: Array<{ label: "X" | "Y" | "Z"; value: number }>;
  products: InventoryProductFacts[];
  stockAlerts: Array<{
    id: string;
    productId: string;
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    detail: string;
  }>;
  reorderSuggestions: Array<{
    productId: string;
    title: string;
    suggestedQuantity: number;
    urgency: number;
  }>;
  overstockProducts: Array<{ productId: string; title: string; detail: string }>;
  understockProducts: Array<{ productId: string; title: string; detail: string }>;
  deadInventory: Array<{ productId: string; title: string; detail: string }>;
};

export type InventoryFactsSource = {
  getStoreInventorySnapshot(input: { storeId: string }): Promise<{
    products: Array<{
      productId: string;
      title: string;
      sku: string | null;
      inventory: number | null;
      reservedInventory: number | null;
      unitCost: number | null;
      updatedAt: string;
      salesByDay: Array<{ day: string; quantity: number }>;
    }>;
    unifiedMetrics: UnifiedStoreMetrics;
  } | null>;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

export function createInventoryFactsBuilder(
  source: InventoryFactsSource,
): FactBuilder<InventoryFacts> {
  return {
    agentId: "inventory_intelligence",
    async build(context: FactBuilderContext): Promise<InventoryFacts> {
      const snapshot = await source.getStoreInventorySnapshot({ storeId: context.storeId });

      if (!snapshot) {
        throw new Error("inventory_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      void getTrafficMetrics(snapshot.unifiedMetrics);
      const products: InventoryProductFacts[] = snapshot.products.map((product) => {
        const sales = calculateSalesWindowMetrics({
          quantitiesByDay: product.salesByDay.map((entry) => ({
            day: entry.day,
            quantity: entry.quantity,
            revenue: 0,
            orderCount: 0,
          })),
        });
        const velocity = calculateInventoryVelocity(sales.sales30Days);
        const inventory = buildInventoryMetrics({
          inventory: product.inventory,
          reservedInventory: product.reservedInventory,
          daysRemaining: calculateDaysOfInventoryRemaining(
            product.inventory === null
              ? null
              : Math.max(0, product.inventory - (product.reservedInventory ?? 0)),
            velocity,
          ),
          velocity,
        });
        const daysRemaining = calculateDaysOfInventoryRemaining(
          inventory.availableInventory,
          velocity,
        );
        const lastSaleDay =
          [...product.salesByDay].sort((left, right) => right.day.localeCompare(left.day))[0]?.day ??
          null;
        const agingDays = calculateInventoryAgingDays({
          lastSaleAt: lastSaleDay,
          updatedAt: product.updatedAt,
          computedAt,
        });
        const stockout = predictStockoutDate({
          availableInventory: inventory.availableInventory,
          velocity,
          computedAt,
        });
        const safetyStock = calculateSafetyStock(velocity);
        const reorderUrgency = calculateReorderUrgency({
          daysRemaining,
          stockRisk: inventory.stockRisk,
          velocity,
        });

        const leadTimeDays = estimateLeadTimeDays({ velocity, reorderUrgency });
        const sellThroughRate = calculateSellThroughRate({
          unitsSold: sales.sales30Days,
          availableInventory: inventory.availableInventory,
        });
        const overstockRisk = calculateOverstockRisk({
          daysRemaining,
          velocity,
          availableInventory: inventory.availableInventory,
        });
        const understockRisk = calculateUnderstockRisk({
          daysRemaining,
          stockRisk: inventory.stockRisk,
        });
        const deadStock = classifyDeadStock({
          agingDays,
          velocity,
          availableInventory: inventory.availableInventory,
          sales90Days: sales.sales90Days,
        });

        return {
          productId: product.productId,
          title: product.title,
          sku: product.sku,
          inventory: inventory.inventory,
          availableInventory: inventory.availableInventory,
          sales30Days: sales.sales30Days,
          sales90Days: sales.sales90Days,
          velocity,
          turnover: calculateInventoryTurnover({
            sales30Days: sales.sales30Days,
            averageInventory: inventory.availableInventory,
          }),
          daysRemaining,
          weeksOfCover: calculateWeeksOfCover(daysRemaining),
          agingDays,
          overstockRisk,
          understockRisk,
          stockRisk: stockout.stockoutRisk,
          stockoutPredictionDate: stockout.predictedStockoutDate,
          reorderUrgency,
          deadStock,
          safetyStock,
          runOutDate: calculateEstimatedRunOutDate({
            availableInventory: inventory.availableInventory,
            velocity,
            computedAt,
          }),
          unitCost: product.unitCost,
          sellThroughRate,
          abcClass: "C" as const,
          xyzClass: "Z" as const,
          inventoryRiskScore: calculateInventoryRiskScore({
            stockRisk: stockout.stockoutRisk,
            overstockRisk,
            understockRisk,
            deadStock,
            agingDays,
          }),
          leadTimeDays,
          capitalLocked: (inventory.availableInventory ?? 0) * (product.unitCost ?? 0),
        };
      });

      const abcAnalysis = buildAbcAnalysis(
        snapshot.products.map((product) => ({
          productId: product.productId,
          title: product.title,
          sales30Days:
            products.find((item) => item.productId === product.productId)?.sales30Days ?? 0,
          unitCost: product.unitCost,
        })),
      );
      const xyzAnalysis = buildXyzAnalysis(
        snapshot.products.map((product) => ({
          productId: product.productId,
          title: product.title,
          dailyQuantities: product.salesByDay.map((entry) => entry.quantity),
        })),
      );

      const classifiedProducts = products.map((product) => ({
        ...product,
        abcClass:
          abcAnalysis.products.find((item) => item.productId === product.productId)?.abcClass ??
          product.abcClass,
        xyzClass:
          xyzAnalysis.products.find((item) => item.productId === product.productId)?.xyzClass ??
          product.xyzClass,
      }));

      const movers = identifyMoverProducts(
        classifiedProducts.map((product) => ({
          ...product,
          productId: product.productId,
          sellThroughRate: product.sellThroughRate,
        })),
      );
      const stockoutAlertCount = classifiedProducts.filter((product) =>
        isStockoutRisk(product.stockRisk),
      ).length;
      const deadStockCount = classifiedProducts.filter((product) => product.deadStock).length;
      const overstockCount = classifiedProducts.filter((product) => product.overstockRisk).length;
      const understockCount = classifiedProducts.filter((product) => product.understockRisk).length;
      const averageDaysRemaining = average(
        classifiedProducts
          .map((product) => product.daysRemaining)
          .filter((value): value is number => value !== null),
      );
      const averageWeeksOfCover = calculateAverageWeeksOfCover(
        classifiedProducts.map((product) => product.daysRemaining),
      );
      const averageTurnover = average(classifiedProducts.map((product) => product.turnover)) ?? 0;
      const averageSellThroughRate = calculateAverageSellThroughRate(
        classifiedProducts.map((product) => ({
          unitsSold: product.sales30Days,
          availableInventory: product.availableInventory,
        })),
      );
      const capitalLockedInInventory = Number(
        classifiedProducts
          .reduce((total, product) => total + product.capitalLocked, 0)
          .toFixed(2),
      );
      const inventoryHealthScore = calculateInventoryHealthScore({
        stockoutAlertCount,
        deadStockCount,
        overstockCount,
        understockCount,
        totalProducts: classifiedProducts.length,
        averageDaysRemaining,
        averageTurnover,
      });

      const stockAlerts = classifiedProducts
        .filter((product) => isStockoutRisk(product.stockRisk))
        .map((product) => ({
          id: `stockout:${product.productId}`,
          productId: product.productId,
          title: product.title,
          severity:
            product.stockRisk === "CRITICAL"
              ? ("critical" as const)
              : product.stockRisk === "HIGH"
                ? ("high" as const)
                : ("medium" as const),
          detail: `Projected stockout in ${product.daysRemaining ?? 0} days at ${product.velocity} units/day`,
        }));

      const reorderSuggestions = classifiedProducts
        .map((product) =>
          buildReorderSuggestion({
            productId: product.productId,
            title: product.title,
            velocity: product.velocity,
            availableInventory: product.availableInventory,
            safetyStock: product.safetyStock,
            reorderUrgency: product.reorderUrgency,
          }),
        )
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .sort((left, right) => left.urgency - right.urgency);

      const overstockProducts = classifiedProducts
        .filter((product) => product.overstockRisk)
        .map((product) => ({
          productId: product.productId,
          title: product.title,
          detail: `${product.daysRemaining ?? "Unknown"} days of coverage at current velocity`,
        }));

      const understockProducts = classifiedProducts
        .filter((product) => product.understockRisk)
        .map((product) => ({
          productId: product.productId,
          title: product.title,
          detail: `${product.daysRemaining ?? 0} days remaining with ${product.velocity} units/day velocity`,
        }));

      const deadInventory = classifiedProducts
        .filter((product) => product.deadStock)
        .map((product) => ({
          productId: product.productId,
          title: product.title,
          detail: `${product.agingDays} days since last meaningful sale with ${product.availableInventory ?? 0} units on hand`,
        }));

      return {
        storeId: context.storeId,
        computedAt,
        inventoryHealthScore,
        totalProducts: classifiedProducts.length,
        totalInventoryUnits: classifiedProducts.reduce(
          (total, product) => total + (product.availableInventory ?? 0),
          0,
        ),
        deadStockCount,
        stockoutAlertCount,
        overstockCount,
        understockCount,
        averageDaysRemaining,
        averageWeeksOfCover,
        averageTurnover,
        averageSellThroughRate,
        capitalLockedInInventory,
        fastMoverCount: movers.fastMovers.length,
        slowMoverCount: movers.slowMovers.length,
        abcDistribution: abcAnalysis.distribution,
        xyzDistribution: xyzAnalysis.distribution,
        products: classifiedProducts,
        stockAlerts,
        reorderSuggestions,
        overstockProducts,
        understockProducts,
        deadInventory,
      };
    },
    fingerprint(facts: InventoryFacts): string {
      return buildFactFingerprint(facts as unknown as Record<string, unknown>);
    },
  };
}
