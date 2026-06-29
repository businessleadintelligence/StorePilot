import type { StoreRecommendationsResult } from "../types/store-dashboard";
import { getRecommendationBadgeTone } from "../lib/display";

type RecommendationsCardProps = {
  recommendations: StoreRecommendationsResult;
};

export function RecommendationsCard({ recommendations }: RecommendationsCardProps) {
  return (
    <s-section heading="Recommendations">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        {recommendations.recommendations.length > 0 ? (
          <s-stack gap="base">
            {recommendations.recommendations.map((item) => (
              <s-box
                key={item.id}
                padding="base"
                background="subdued"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-badge tone={getRecommendationBadgeTone(item.severity)}>
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
            <s-text type="strong">No issues detected.</s-text>
            <s-paragraph color="subdued">
              Store operations look healthy.
            </s-paragraph>
          </s-stack>
        )}
      </s-box>
    </s-section>
  );
}
