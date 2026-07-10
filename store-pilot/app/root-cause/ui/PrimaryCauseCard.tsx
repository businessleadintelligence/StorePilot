import type { RootCauseUiItem } from "../shared/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

type PrimaryCauseCardProps = {
  item: RootCauseUiItem;
};

export function PrimaryCauseCard({ item }: PrimaryCauseCardProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{item.primaryCause}</s-text>
          <ConfidenceBadge confidencePercent={item.confidencePercent} />
        </s-stack>
        <s-text color="subdued">Outcome: {item.businessOutcome.replace(/_/g, " ")}</s-text>
        <s-stack direction="inline" gap="base">
          <s-text color="subdued">Evidence: {item.evidenceCount}</s-text>
          <s-text color="subdued">Timeline events: {item.timelineLength}</s-text>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
