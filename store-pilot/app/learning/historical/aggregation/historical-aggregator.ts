import prisma from "../../../db.server";
import { orderWhereForMetrics } from "../../../lib/order-query-filters.server";
import type { HistoricalAggregationSnapshot } from "../shared/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function aggregateHistoricalStoreData(
  storeId: string,
): Promise<HistoricalAggregationSnapshot> {
  const now = new Date();
  const recent30 = new Date(now.getTime() - 30 * 86400000);
  const prior60 = new Date(now.getTime() - 60 * 86400000);

  const [
    products,
    orders,
    evidenceGroups,
    lowStockCount,
    outOfStockCount,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { storeId },
      select: {
        title: true,
        status: true,
        price: true,
        inventoryQuantity: true,
      },
    }),
    prisma.order.findMany({
      where: orderWhereForMetrics(storeId, { isTest: false }),
      select: {
        totalPriceAmount: true,
        totalRefundedAmount: true,
        shopifyCreatedAt: true,
      },
    }),
    prisma.evidence.groupBy({
      by: ["factType"],
      where: { storeId, active: true },
      _count: { factType: true },
    }),
    prisma.evidence.count({
      where: { storeId, active: true, factType: { in: ["InventoryLow", "InventoryCritical"] } },
    }),
    prisma.evidence.count({
      where: { storeId, active: true, factType: "OutOfStock" },
    }),
  ]);

  const evidenceByFactType = Object.fromEntries(
    evidenceGroups.map((group) => [group.factType, group._count.factType]),
  );

  const prices = products
    .map((product) => (product.price ? Number(product.price) : null))
    .filter((price): price is number => price !== null && price > 0);
  const averageProductPrice =
    prices.length > 0 ? round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : 0;

  const totalInventoryUnits = products.reduce(
    (sum, product) => sum + (product.inventoryQuantity ?? 0),
    0,
  );

  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.totalPriceAmount),
    0,
  );
  const totalRefunded = orders.reduce(
    (sum, order) => sum + Number(order.totalRefundedAmount),
    0,
  );
  const averageOrderValue = orders.length > 0 ? round(totalRevenue / orders.length) : 0;
  const refundRatio = totalRevenue > 0 ? round(totalRefunded / totalRevenue, 4) : 0;

  const recent30DayRevenue = orders
    .filter((order) => order.shopifyCreatedAt >= recent30)
    .reduce((sum, order) => sum + Number(order.totalPriceAmount), 0);
  const prior30DayRevenue = orders
    .filter(
      (order) => order.shopifyCreatedAt >= prior60 && order.shopifyCreatedAt < recent30,
    )
    .reduce((sum, order) => sum + Number(order.totalPriceAmount), 0);

  const ordersByDayOfWeek = DAY_NAMES.map((_, dayOfWeek) => {
    const dayOrders = orders.filter(
      (order) => order.shopifyCreatedAt.getUTCDay() === dayOfWeek,
    );
    return {
      dayOfWeek,
      orderCount: dayOrders.length,
      revenue: round(dayOrders.reduce((sum, order) => sum + Number(order.totalPriceAmount), 0)),
    };
  });

  const titleCounts = new Map<string, number>();
  for (const product of products) {
    const key = product.title.trim();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  const topProductTitles = [...titleCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([title, count]) => ({ title, count }));

  return {
    productCount: products.length,
    activeProductCount: products.filter((product) => product.status === "active").length,
    orderCount: orders.length,
    totalRevenue: round(totalRevenue),
    averageOrderValue,
    averageProductPrice,
    totalInventoryUnits,
    lowStockEvidenceCount: lowStockCount,
    outOfStockEvidenceCount: outOfStockCount,
    refundRatio,
    recent30DayRevenue: round(recent30DayRevenue),
    prior30DayRevenue: round(prior30DayRevenue),
    ordersByDayOfWeek,
    evidenceByFactType,
    topProductTitles,
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
