import type { ExperimentUiItem } from "../shared/types";

type SuggestedExperimentCardProps = {
  item: ExperimentUiItem;
  currency: string;
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function riskTone(risk: string): "success" | "warning" | "critical" {
  if (risk === "low") return "success";
  if (risk === "medium") return "warning";
  return "critical";
}

export function SuggestedExperimentCard({ item, currency }: SuggestedExperimentCardProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">Suggested Experiment</s-text>
          <s-badge tone={item.confidencePercent >= 85 ? "success" : "info"}>
            {item.confidencePercent}% confidence
          </s-badge>
        </s-stack>
        <s-text type="strong">{item.title}</s-text>
        <s-text>{item.proposedChange}</s-text>
        <s-text color="subdued">Reason: {item.reason}</s-text>
        <s-stack direction="inline" gap="base">
          <s-text color="subdued">
            Expected monthly revenue: {formatCurrency(item.expectedMonthlyGain, currency)}
          </s-text>
          <s-badge tone={riskTone(item.businessRisk)}>
            {item.businessRisk} risk
          </s-badge>
        </s-stack>
        <s-text color="subdued">Estimated duration: {item.estimatedDurationDays} days</s-text>
        <s-stack direction="inline" gap="small-200">
          <s-button variant="primary">Approve</s-button>
          <s-button variant="secondary">Dismiss</s-button>
          <s-button variant="tertiary">Learn More</s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
