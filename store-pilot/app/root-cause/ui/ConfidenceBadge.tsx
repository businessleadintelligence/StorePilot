type ConfidenceBadgeProps = {
  confidencePercent: number;
};

export function ConfidenceBadge({ confidencePercent }: ConfidenceBadgeProps) {
  const tone =
    confidencePercent >= 85 ? "success" : confidencePercent >= 65 ? "info" : "warning";
  return <s-badge tone={tone}>{confidencePercent}% confidence</s-badge>;
}
