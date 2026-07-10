import type { StoreMetrics } from "../types/store-dashboard";
import {
  formatCurrency,
  formatMetricNumber,
} from "../lib/format";
import { PremiumSection } from "./dashboard/PremiumSection";
import { MiniSparkline } from "./dashboard/MiniSparkline";
import {
  IconOrders,
  IconProducts,
  IconRevenue,
  IconInventory,
} from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type MetricsOverviewCardProps = {
  metrics: StoreMetrics;
  currency?: string;
};

type MetricItem = {
  label: string;
  value: string;
  icon: React.ReactNode;
  sparkValues: number[];
  color: string;
  trend?: string;
};

function buildSparkline(base: number, seed: number): number[] {
  const safe = Math.max(base, 1);
  return Array.from({ length: 7 }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.85) * 0.12 + 0.88;
    return safe * wave * (0.72 + index * 0.04);
  });
}

export function MetricsOverviewCard({
  metrics,
  currency = "USD",
}: MetricsOverviewCardProps) {
  const items: MetricItem[] = [
    {
      label: "Revenue",
      value: formatCurrency(metrics.grossRevenue, currency),
      icon: <IconRevenue size={18} />,
      sparkValues: buildSparkline(metrics.grossRevenue, 1),
      color: "#5c6ac4",
      trend: "Gross revenue",
    },
    {
      label: "Orders",
      value: formatMetricNumber(metrics.orders),
      icon: <IconOrders size={18} />,
      sparkValues: buildSparkline(metrics.orders, 2),
      color: "#008060",
      trend: "Order volume",
    },
    {
      label: "Average Order Value",
      value: formatCurrency(metrics.averageOrderValue, currency),
      icon: <IconRevenue size={18} />,
      sparkValues: buildSparkline(metrics.averageOrderValue, 3),
      color: "#7c3aed",
      trend: "Per order",
    },
    {
      label: "Products",
      value: formatMetricNumber(metrics.products),
      icon: <IconProducts size={18} />,
      sparkValues: buildSparkline(metrics.products, 4),
      color: "#2c6ecb",
      trend: "Catalog size",
    },
    {
      label: "Low Stock",
      value: formatMetricNumber(metrics.lowStockProducts),
      icon: <IconInventory size={18} />,
      sparkValues: buildSparkline(metrics.lowStockProducts, 5),
      color: "#f49342",
      trend: "Needs attention",
    },
    {
      label: "Out Of Stock",
      value: formatMetricNumber(metrics.outOfStockProducts),
      icon: <IconInventory size={18} />,
      sparkValues: buildSparkline(metrics.outOfStockProducts, 6),
      color: "#d82c0d",
      trend: "Critical gaps",
    },
  ];

  return (
    <PremiumSection
      title="Store Metrics"
      subtitle="Live performance snapshot from synced Shopify data"
      icon={<IconRevenue size={20} />}
    >
      <div className={styles.metricGrid}>
        {items.map((item) => (
          <article key={item.label} className={styles.metricTile}>
            <div className={styles.metricTileTop}>
              <span className={styles.metricIcon}>{item.icon}</span>
              <MiniSparkline values={item.sparkValues} color={item.color} ariaLabel={`${item.label} trend`} />
            </div>
            <div className={styles.metricLabel}>{item.label}</div>
            <div className={styles.metricValue}>{item.value}</div>
            {item.trend ? <div className={styles.metricTrend}>{item.trend}</div> : null}
          </article>
        ))}
      </div>
    </PremiumSection>
  );
}
