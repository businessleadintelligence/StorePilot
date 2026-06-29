import { buildFactFingerprint } from "../cache/fingerprint";
import type { UnifiedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import { getTrafficMetrics } from "../migration/unified-metrics-migration";
import type { SalesTrend } from "../tools/trend-tool";
import type { StockRisk } from "../tools/inventory-tool";
import {
  buildInventoryMetrics,
  buildRefundMetrics,
  calculateSalesWindowMetrics,
  calculateTrend,
  calculateVelocity,
  calculateDaysRemaining,
  calculateProductHealthScore,
} from "../tools";
import type { FactBuilder, FactBuilderContext } from "./types";

export type ProductFacts = {
  storeId: string;
  productId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  title: string;
  vendor: string | null;
  category: string | null;
  status: string;
  inventory: number | null;
  availableInventory: number | null;
  reservedInventory: number | null;
  sales7Days: number;
  sales30Days: number;
  sales90Days: number;
  revenue30Days: number;
  orders30Days: number;
  refundCount30Days: number;
  refundRate: number;
  velocity: number;
  daysRemaining: number | null;
  trend: SalesTrend;
  stockRisk: StockRisk;
  margin: number | null;
  healthScore: number;
  createdAt: string;
  updatedAt: string;
  computedAt: string;
};

export type ProductFactsSource = {
  getProductSnapshot(input: {
    storeId: string;
    productId: string;
  }): Promise<{
    productId: string;
    shopifyProductId: string;
    shopifyVariantId: string;
    title: string;
    vendor: string | null;
    category: string | null;
    status: string;
    inventory: number | null;
    reservedInventory: number | null;
    margin: number | null;
    createdAt: string;
    updatedAt: string;
    salesByDay: Array<{ day: string; quantity: number; revenue: number; orderCount: number }>;
    refundCount30Days: number;
    unifiedMetrics: UnifiedStoreMetrics;
  } | null>;
};

export function createProductFactsBuilder(source: ProductFactsSource): FactBuilder<
  ProductFacts,
  { productId: string }
> {
  return {
    agentId: "product_intelligence",
    async build(context: FactBuilderContext & { productId: string }): Promise<ProductFacts> {
      const snapshot = await source.getProductSnapshot({
        storeId: context.storeId,
        productId: context.productId,
      });

      if (!snapshot) {
        throw new Error("product_facts_unavailable");
      }

      const sales = calculateSalesWindowMetrics({ quantitiesByDay: snapshot.salesByDay });
      void getTrafficMetrics(snapshot.unifiedMetrics);
      const velocity = calculateVelocity(sales.sales30Days);
      const inventory = buildInventoryMetrics({
        inventory: snapshot.inventory,
        reservedInventory: snapshot.reservedInventory,
        daysRemaining: calculateDaysRemaining(
          snapshot.inventory === null
            ? null
            : Math.max(0, snapshot.inventory - (snapshot.reservedInventory ?? 0)),
          velocity,
        ),
        velocity,
      });
      const refunds = buildRefundMetrics({
        refundCount30Days: snapshot.refundCount30Days,
        orders30Days: sales.orders30Days,
      });

      return {
        storeId: context.storeId,
        productId: snapshot.productId,
        shopifyProductId: snapshot.shopifyProductId,
        shopifyVariantId: snapshot.shopifyVariantId,
        title: snapshot.title,
        vendor: snapshot.vendor,
        category: snapshot.category,
        status: snapshot.status,
        inventory: inventory.inventory,
        availableInventory: inventory.availableInventory,
        reservedInventory: inventory.reservedInventory,
        sales7Days: sales.sales7Days,
        sales30Days: sales.sales30Days,
        sales90Days: sales.sales90Days,
        revenue30Days: sales.revenue30Days,
        orders30Days: sales.orders30Days,
        refundCount30Days: refunds.refundCount30Days,
        refundRate: refunds.refundRate,
        velocity,
        daysRemaining: calculateDaysRemaining(inventory.availableInventory, velocity),
        trend: calculateTrend(sales.sales7Days, sales.sales30Days),
        stockRisk: inventory.stockRisk,
        margin: snapshot.margin,
        healthScore: calculateProductHealthScore({
          stockRisk: inventory.stockRisk,
          trend: calculateTrend(sales.sales7Days, sales.sales30Days),
          refundRate: refunds.refundRate,
          sales30Days: sales.sales30Days,
          margin: snapshot.margin,
        }),
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        computedAt: new Date().toISOString(),
      };
    },
    fingerprint(facts: ProductFacts): string {
      return buildFactFingerprint(facts as unknown as Record<string, unknown>);
    },
  };
}
