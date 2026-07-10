import type { RootCauseUiItem } from "../shared/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

type RootCauseCardProps = {
  item: RootCauseUiItem;
  currency: string;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RootCauseCard({ item, currency }: RootCauseCardProps) {
  return (
    <s-box padding="small-200" background="subdued" borderRadius="base">
      <s-stack gap="small-100">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{item.primaryCause}</s-text>
          <s-badge>{item.severity}</s-badge>
        </s-stack>
        <ConfidenceBadge confidencePercent={item.confidencePercent} />
        {item.revenueImpact > 0 ? (
          <s-text color="subdued">
            Revenue impact: {formatCurrency(item.revenueImpact, currency)}
          </s-text>
        ) : null}
        <s-text color="subdued">{item.evidenceCount} evidence signals</s-text>
      </s-stack>
    </s-box>
  );
}
