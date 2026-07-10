import type { PredictionUiItem } from "../shared/types";

type PredictionCardProps = {
  item: PredictionUiItem;
  currency: string;
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function riskLabel(type: string): string {
  const labels: Record<string, string> = {
    revenue_forecast: "Revenue Risk",
    seo_traffic_decline: "SEO Risk",
    refund_increase: "Refund Risk",
    inventory_stockout: "Inventory Risk",
    pricing_margin_risk: "Pricing Risk",
    collection_inactive: "Collection Risk",
    operational_supplier_delay: "Operational Risk",
  };
  return labels[type] ?? "Forecast Risk";
}

export function PredictionCard({ item, currency }: PredictionCardProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{riskLabel(item.predictionType)}</s-text>
          <s-badge tone={item.confidencePercent >= 85 ? "critical" : "warning"}>
            {item.confidencePercent}% confidence
          </s-badge>
        </s-stack>
        <s-text>{item.title}</s-text>
        <s-text color="subdued">Expected: {item.predictedOutcome}</s-text>
        {item.expectedBusinessImpact > 0 ? (
          <s-text color="subdued">
            Impact: {formatCurrency(item.expectedBusinessImpact, currency)}
          </s-text>
        ) : null}
        {item.preventionAction ? (
          <s-stack gap="small-100">
            <s-text type="strong">Recommended action</s-text>
            <s-text>{item.preventionAction}</s-text>
            {item.expectedImpactProtected > 0 ? (
              <s-text color="subdued">
                Expected revenue protected:{" "}
                {formatCurrency(item.expectedImpactProtected, currency)}
              </s-text>
            ) : null}
          </s-stack>
        ) : null}
      </s-stack>
    </s-box>
  );
}
