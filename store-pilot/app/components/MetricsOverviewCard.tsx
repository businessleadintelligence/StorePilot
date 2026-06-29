import type { StoreMetrics } from "../types/store-dashboard";
import {
  formatCurrency,
  formatMetricNumber,
} from "../lib/format";

type MetricsOverviewCardProps = {
  metrics: StoreMetrics;
  currency?: string;
};

type MetricItem = {
  label: string;
  value: string;
};

export function MetricsOverviewCard({
  metrics,
  currency = "USD",
}: MetricsOverviewCardProps) {
  const items: MetricItem[] = [
    {
      label: "Revenue",
      value: formatCurrency(metrics.grossRevenue, currency),
    },
    {
      label: "Orders",
      value: formatMetricNumber(metrics.orders),
    },
    {
      label: "Average Order Value",
      value: formatCurrency(metrics.averageOrderValue, currency),
    },
    {
      label: "Products",
      value: formatMetricNumber(metrics.products),
    },
    {
      label: "Low Stock",
      value: formatMetricNumber(metrics.lowStockProducts),
    },
    {
      label: "Out Of Stock",
      value: formatMetricNumber(metrics.outOfStockProducts),
    },
  ];

  return (
    <s-section heading="Store Metrics">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-grid
          gridTemplateColumns="@container (inline-size > 900px) repeat(3, 1fr), @container (inline-size > 500px) repeat(2, 1fr), 1fr"
          gap="base"
        >
          {items.map((item) => (
            <s-grid-item key={item.label}>
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text color="subdued">{item.label}</s-text>
                  <s-heading>{item.value}</s-heading>
                </s-stack>
              </s-box>
            </s-grid-item>
          ))}
        </s-grid>
      </s-box>
    </s-section>
  );
}
