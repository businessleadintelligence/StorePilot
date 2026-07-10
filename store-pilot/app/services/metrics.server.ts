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

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

function resolveMetricsCacheTtlMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.STORE_METRICS_CACHE_TTL_MS);
  if (!Number.isFinite(raw) || raw < 30_000) {
    return DEFAULT_CACHE_TTL_MS;
  }
  return Math.min(60 * 60 * 1000, Math.floor(raw));
}

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

function mapCacheRowToMetrics(row: {
  products: number;
  activeProducts: number;
  orders: number;
  grossRevenue: Prisma.Decimal;
  averageOrderValue: Prisma.Decimal;
  lowStockProducts: number;
  outOfStockProducts: number;
  inventoryUnits: number;
}): StoreMetrics {
  return serializeMetricsForLoader({
    products: row.products,
    activeProducts: row.activeProducts,
    orders: row.orders,
    grossRevenue: decimalToNumber(row.grossRevenue),
    averageOrderValue: decimalToNumber(row.averageOrderValue),
    lowStockProducts: row.lowStockProducts,
    outOfStockProducts: row.outOfStockProducts,
    inventoryUnits: row.inventoryUnits,
  });
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

export async function computeStoreMetricsLive(
  storeId: string,
): Promise<StoreMetrics> {
  if (!storeId) {
    return { ...EMPTY_METRICS };
  }

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
}

export async function recomputeStoreMetricsCache(
  storeId: string,
): Promise<StoreMetrics> {
  const metrics = await computeStoreMetricsLive(storeId);

  await prisma.storeMetricsCache.upsert({
    where: { storeId },
    create: {
      storeId,
      products: metrics.products,
      activeProducts: metrics.activeProducts,
      orders: metrics.orders,
      grossRevenue: metrics.grossRevenue,
      averageOrderValue: metrics.averageOrderValue,
      lowStockProducts: metrics.lowStockProducts,
      outOfStockProducts: metrics.outOfStockProducts,
      inventoryUnits: metrics.inventoryUnits,
      computedAt: new Date(),
    },
    update: {
      products: metrics.products,
      activeProducts: metrics.activeProducts,
      orders: metrics.orders,
      grossRevenue: metrics.grossRevenue,
      averageOrderValue: metrics.averageOrderValue,
      lowStockProducts: metrics.lowStockProducts,
      outOfStockProducts: metrics.outOfStockProducts,
      inventoryUnits: metrics.inventoryUnits,
      computedAt: new Date(),
    },
  });

  return metrics;
}

function isCacheFresh(computedAt: Date, ttlMs: number): boolean {
  return Date.now() - computedAt.getTime() <= ttlMs;
}

export async function getStoreMetrics(storeId: string): Promise<StoreMetrics> {
  if (!storeId) {
    return { ...EMPTY_METRICS };
  }

  const ttlMs = resolveMetricsCacheTtlMs();

  try {
    const cached = await prisma.storeMetricsCache.findUnique({
      where: { storeId },
    });

    if (cached && isCacheFresh(cached.computedAt, ttlMs)) {
      return mapCacheRowToMetrics(cached);
    }

    if (cached) {
      void recomputeStoreMetricsCache(storeId).catch(() => undefined);
      return mapCacheRowToMetrics(cached);
    }

    return await recomputeStoreMetricsCache(storeId);
  } catch {
    try {
      return await computeStoreMetricsLive(storeId);
    } catch {
      return { ...EMPTY_METRICS };
    }
  }
}
