import type { DailyOperatingPlanPayload } from "../../executive/shared/types";

type DailyOperatingPlanCardProps = {
  plan: DailyOperatingPlanPayload;
  currency: string;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DailyOperatingPlanCard({ plan, currency }: DailyOperatingPlanCardProps) {
  return (
    <s-section heading="Today's business plan">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-stack gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone="info">{plan.taskCount} tasks</s-badge>
            <s-text color="subdued">{plan.estimatedCompletionMinutes} min estimated</s-text>
            <s-text color="subdued">
              Revenue: {formatCurrency(plan.estimatedRevenueOpportunity, currency)}
            </s-text>
          </s-stack>

          <s-stack gap="small-200">
            {plan.tasks.slice(0, 6).map((task) => (
              <s-box
                key={task.decisionId}
                padding="small-200"
                background="subdued"
                borderRadius="base"
              >
                <s-stack gap="small-100">
                  <s-text type="strong">{task.title}</s-text>
                  <s-text color="subdued">{task.reason}</s-text>
                  <s-stack direction="inline" gap="base">
                    <s-text color="subdued">Impact: {task.businessImpact}</s-text>
                    <s-text color="subdued">
                      Confidence: {Math.round(task.confidence * 100)}%
                    </s-text>
                    <s-text color="subdued">{task.estimatedTimeMinutes} min</s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-stack>
      </s-box>
    </s-section>
  );
}
