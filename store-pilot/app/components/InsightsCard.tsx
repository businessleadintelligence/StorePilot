import type { StoreInsightsResult } from "../types/store-dashboard";
import { getInsightBadgeTone } from "../lib/display";

type InsightsCardProps = {
  insights: StoreInsightsResult;
};

export function InsightsCard({ insights }: InsightsCardProps) {
  return (
    <s-section heading="Operational Insights">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        {insights.insights.length > 0 ? (
          <s-stack gap="base">
            {insights.insights.map((item) => (
              <s-box
                key={item.id}
                padding="base"
                background="subdued"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-badge tone={getInsightBadgeTone(item.severity)}>
                      {item.severity}
                    </s-badge>
                    <s-text type="strong">{item.title}</s-text>
                  </s-stack>
                  <s-paragraph>{item.description}</s-paragraph>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-stack gap="small-200">
            <s-text type="strong">No operational insights.</s-text>
            <s-paragraph color="subdued">
              Your store operations look healthy.
            </s-paragraph>
          </s-stack>
        )}
      </s-box>
    </s-section>
  );
}
