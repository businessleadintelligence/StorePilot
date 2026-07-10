import type { DecisionCardPayload } from "../../executive/shared/types";

type DecisionCardProps = {
  card: DecisionCardPayload;
  currency: string;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DecisionCard({ card, currency }: DecisionCardProps) {
  return (
    <s-box padding="small-200" background="subdued" borderRadius="base">
      <s-stack gap="small-100">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{card.title}</s-text>
          <s-badge>{card.category}</s-badge>
        </s-stack>
        {card.estimatedLossPerDay ? (
          <s-text color="subdued">
            Estimated loss: {formatCurrency(card.estimatedLossPerDay, currency)}/day
          </s-text>
        ) : null}
        <s-text color="subdued">Cause: {card.cause}</s-text>
        <s-stack direction="inline" gap="base">
          <s-text color="subdued">Confidence: {card.confidencePercent}%</s-text>
          <s-text color="subdued">Impact: {card.businessImpactLabel}</s-text>
        </s-stack>
        {card.evidenceFactTypes.length > 0 ? (
          <s-text color="subdued">Evidence: {card.evidenceFactTypes.join(", ")}</s-text>
        ) : null}
        <s-text type="strong">{card.recommendedAction}</s-text>
      </s-stack>
    </s-box>
  );
}
