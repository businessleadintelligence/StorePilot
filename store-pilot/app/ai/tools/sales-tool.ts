export type SalesWindowMetrics = {
  sales7Days: number;
  sales30Days: number;
  sales90Days: number;
  revenue30Days: number;
  orders30Days: number;
};

export function calculateSalesWindowMetrics(input: {
  quantitiesByDay: Array<{ day: string; quantity: number; revenue: number; orderCount: number }>;
  now?: Date;
}): SalesWindowMetrics {
  const now = input.now ?? new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const withinDays = (days: number) =>
    input.quantitiesByDay.filter((entry) => {
      const delta = now.getTime() - new Date(entry.day).getTime();
      return delta >= 0 && delta <= days * dayMs;
    });

  const sumQuantity = (entries: typeof input.quantitiesByDay) =>
    entries.reduce((total, entry) => total + entry.quantity, 0);
  const sumRevenue = (entries: typeof input.quantitiesByDay) =>
    entries.reduce((total, entry) => total + entry.revenue, 0);
  const sumOrders = (entries: typeof input.quantitiesByDay) =>
    entries.reduce((total, entry) => total + entry.orderCount, 0);

  const last7 = withinDays(7);
  const last30 = withinDays(30);
  const last90 = withinDays(90);

  return {
    sales7Days: sumQuantity(last7),
    sales30Days: sumQuantity(last30),
    sales90Days: sumQuantity(last90),
    revenue30Days: sumRevenue(last30),
    orders30Days: sumOrders(last30),
  };
}
