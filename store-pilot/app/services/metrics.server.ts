import { Prisma } from "@prisma/client";

import prisma from "../db.server";
import { orderWhereForMetrics } from "../lib/order-query-filters.server";

export type StoreMetrics = {
  products: number;
  activeProducts: number;
  orders: number;
  grossRevenue: number;
  averageOrderValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  inventoryUnits: number;
};

const EMPTY_METRICS: StoreMetrics = {
  products: 0,
  activeProducts: 0,
  orders: 0,
  grossRevenue: 0,
  averageOrderValue: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  inventoryUnits: 0,
};

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function calculateAverageOrderValue(
  grossRevenue: number,
  paidOrders: number,
): number {
  if (paidOrders <= 0) {
    return 0;
  }

  const average = grossRevenue / paidOrders;

  if (!Number.isFinite(average)) {
    return 0;
  }

  return Math.max(0, average);
}

export function formatCurrency(
  amount: number,
  currency = "USD",
): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function formatMetricNumber(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: safeValue % 1 === 0 ? 0 : 2,
  }).format(safeValue);
}

export function serializeMetricsForLoader(metrics: StoreMetrics): StoreMetrics {
  return {
    products: Math.max(0, metrics.products),
    activeProducts: Math.max(0, metrics.activeProducts),
    orders: Math.max(0, metrics.orders),
    grossRevenue: Math.max(0, metrics.grossRevenue),
    averageOrderValue: Math.max(0, metrics.averageOrderValue),
    lowStockProducts: Math.max(0, metrics.lowStockProducts),
    outOfStockProducts: Math.max(0, metrics.outOfStockProducts),
    inventoryUnits: Math.max(0, metrics.inventoryUnits),
  };
}

export async function getStoreMetrics(storeId: string): Promise<StoreMetrics> {
  if (!storeId) {
    return { ...EMPTY_METRICS };
  }

  try {
    const [
      products,
      activeProducts,
      orders,
      paidOrderAggregation,
      inventoryAggregation,
      lowStockProducts,
      outOfStockProducts,
    ] = await Promise.all([
      prisma.product.count({
        where: { storeId },
      }),
      prisma.product.count({
        where: {
          storeId,
          status: { not: "archived" },
        },
      }),
      prisma.order.count({
        where: orderWhereForMetrics(storeId),
      }),
      prisma.order.aggregate({
        where: orderWhereForMetrics(storeId, {
          isPaid: true,
        }),
        _sum: {
          totalPriceAmount: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.product.aggregate({
        where: {
          storeId,
          inventoryTracked: true,
          inventoryQuantity: { not: null },
        },
        _sum: {
          inventoryQuantity: true,
        },
      }),
      prisma.product.count({
        where: {
          storeId,
          inventoryTracked: true,
          inventoryQuantity: {
            not: null,
            lte: 5,
          },
        },
      }),
      prisma.product.count({
        where: {
          storeId,
          inventoryTracked: true,
          inventoryQuantity: 0,
        },
      }),
    ]);

    const grossRevenue = decimalToNumber(paidOrderAggregation._sum.totalPriceAmount);
    const paidOrders = paidOrderAggregation._count._all ?? 0;

    return serializeMetricsForLoader({
      products,
      activeProducts,
      orders,
      grossRevenue,
      averageOrderValue: calculateAverageOrderValue(grossRevenue, paidOrders),
      lowStockProducts,
      outOfStockProducts,
      inventoryUnits: Math.max(
        0,
        inventoryAggregation._sum.inventoryQuantity ?? 0,
      ),
    });
  } catch {
    return { ...EMPTY_METRICS };
  }
}
