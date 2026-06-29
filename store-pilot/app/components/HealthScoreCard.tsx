import type { StoreHealthScore } from "../types/store-dashboard";
import { getGradeBadgeTone } from "../lib/display";

type HealthScoreCardProps = {
  healthScore: StoreHealthScore;
};

export function HealthScoreCard({ healthScore }: HealthScoreCardProps) {
  return (
    <s-section heading="Store Health Score">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-stack gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack gap="small-200">
              <s-text color="subdued">Health Score</s-text>
              <s-heading>
                {healthScore.score} / 100
              </s-heading>
            </s-stack>
            <s-badge tone={getGradeBadgeTone(healthScore.grade)}>
              Grade {healthScore.grade}
            </s-badge>
          </s-stack>

          <s-stack gap="small-200">
            <s-text type="strong">Breakdown</s-text>
            <s-text>Products {healthScore.productsScore}/30</s-text>
            <s-text>Inventory {healthScore.inventoryScore}/30</s-text>
            <s-text>Orders {healthScore.ordersScore}/40</s-text>
          </s-stack>

          {healthScore.issues.length > 0 ? (
            <s-stack gap="small-200">
              <s-text type="strong">Issues</s-text>
              <s-unordered-list>
                {healthScore.issues.map((issue) => (
                  <s-list-item key={issue}>{issue}</s-list-item>
                ))}
              </s-unordered-list>
            </s-stack>
          ) : (
            <s-text color="subdued">
              No operational issues detected from synced store data.
            </s-text>
          )}
        </s-stack>
      </s-box>
    </s-section>
  );
}
