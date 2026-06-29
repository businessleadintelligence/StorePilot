import type { BillingDashboardData } from "../../billing/billing-types";

type BillingDashboardProps = {
  dashboard: BillingDashboardData;
};

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{label}</s-text>
          <s-text color="subdued">
            {used} / {limit}
          </s-text>
        </s-stack>
        <s-text color="subdued">{percent}% used</s-text>
      </s-stack>
    </s-box>
  );
}

export function BillingDashboard({ dashboard }: BillingDashboardProps) {
  return (
    <s-page heading="Billing & Subscription">
      <s-section heading="Current Plan">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-heading>{dashboard.currentPlan.name}</s-heading>
              <s-badge tone={dashboard.commercialStatus === "active" ? "success" : "warning"}>
                {dashboard.commercialStatus}
              </s-badge>
            </s-stack>
            <s-text>${dashboard.currentPlan.monthlyPriceUsd}/month</s-text>
            <s-text color="subdued">{dashboard.currentPlan.description}</s-text>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Trial Status">
        <s-box padding="base" background="subdued" borderRadius="base">
          {dashboard.trial.active ? (
            <s-stack gap="small-200">
              <s-text>
                Trial ends in {dashboard.trial.remainingDays} day
                {dashboard.trial.remainingDays === 1 ? "" : "s"}
              </s-text>
              <s-text color="subdued">Ends {dashboard.trial.trialEnd}</s-text>
            </s-stack>
          ) : (
            <s-text color="subdued">
              {dashboard.trial.expired
                ? "Trial expired — select a plan to continue."
                : "No active trial."}
            </s-text>
          )}
        </s-box>
      </s-section>

      <s-section heading="Usage Overview">
        <s-grid gridTemplateColumns="@container (inline-size > 700px) repeat(3, 1fr), 1fr" gap="base">
          <UsageBar label="AI executions" used={dashboard.usage.aiExecutions} limit={dashboard.limits.aiExecutionsPerMonth} />
          <UsageBar
            label="Automation executions"
            used={dashboard.usage.automationExecutions}
            limit={dashboard.limits.automationExecutionsPerMonth}
          />
          <UsageBar
            label="Connector syncs"
            used={dashboard.usage.connectorSyncs}
            limit={dashboard.limits.connectorSyncsPerMonth}
          />
          <UsageBar
            label="Operations"
            used={dashboard.usage.operationsCreated}
            limit={dashboard.limits.operationsPerMonth}
          />
          <UsageBar label="API requests" used={dashboard.usage.apiRequests} limit={dashboard.limits.apiRequestsPerMonth} />
          <UsageBar
            label="Background jobs"
            used={dashboard.usage.backgroundJobs}
            limit={dashboard.limits.backgroundJobsPerMonth}
          />
        </s-grid>
      </s-section>

      <s-section heading="System Limits">
        <s-stack gap="small-200">
          <s-text color="subdued">Sync frequency: every {dashboard.limits.syncFrequencyHours}h</s-text>
          <s-text color="subdued">
            Connectors:{" "}
            {dashboard.limits.connectorMode === "all"
              ? "GA4, Search Console, PageSpeed, Clarity"
              : "One optional connector (GA4, GSC, or Clarity)"}
          </s-text>
          <s-text color="subdued">
            Operations Center: {dashboard.limits.operationsCenterEnabled ? "Enabled" : "Upgrade required"}
          </s-text>
          <s-text color="subdued">
            Automation Center: {dashboard.limits.automationCenterEnabled ? "Enabled" : "Upgrade required"}
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Upgrade Recommendations">
        <s-stack gap="small-200">
          {dashboard.upgradeRecommendations.length === 0 ? (
            <s-text color="subdued">You're on the highest plan for your store size.</s-text>
          ) : (
            dashboard.upgradeRecommendations.map((item) => (
              <s-text key={item} color="subdued">
                {item}
              </s-text>
            ))
          )}
        </s-stack>
      </s-section>

      <s-section heading="Plans">
        <s-grid gridTemplateColumns="@container (inline-size > 700px) repeat(2, 1fr), 1fr" gap="base">
          {dashboard.plans.map((plan) => (
            <s-grid-item key={plan.slug}>
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-text type="strong">{plan.name}</s-text>
                    {plan.primaryPlan ? <s-badge>Popular</s-badge> : null}
                  </s-stack>
                  <s-text>${plan.monthlyPriceUsd}/month</s-text>
                  <s-text color="subdued">{plan.description}</s-text>
                  {dashboard.currentPlan.slug !== plan.slug ? (
                    <form method="post">
                      <input type="hidden" name="intent" value="approve-subscription" />
                      <input type="hidden" name="planSlug" value={plan.slug} />
                      <s-button type="submit">Select plan</s-button>
                    </form>
                  ) : (
                    <s-badge tone="success">Current plan</s-badge>
                  )}
                </s-stack>
              </s-box>
            </s-grid-item>
          ))}
        </s-grid>
      </s-section>

      <s-section heading="Recent Alerts">
        <s-stack gap="small-200">
          {dashboard.notifications.length === 0 ? (
            <s-text color="subdued">No billing alerts.</s-text>
          ) : (
            dashboard.notifications.map((notification) => (
              <s-box key={notification.id} padding="base" background="subdued" borderRadius="base">
                <s-stack gap="small-100">
                  <s-badge tone={notification.severity === "critical" ? "critical" : "warning"}>
                    {notification.severity}
                  </s-badge>
                  <s-text type="strong">{notification.title}</s-text>
                  <s-text color="subdued">{notification.message}</s-text>
                </s-stack>
              </s-box>
            ))
          )}
        </s-stack>
      </s-section>

      <s-section heading="Billing History">
        <s-text color="subdued">Invoice history will appear here after Shopify billing is connected.</s-text>
      </s-section>

      <s-section heading="Manage Subscription">
        <s-stack direction="inline" gap="base">
          {dashboard.canUpgrade ? (
            <form method="post">
              <input type="hidden" name="intent" value="upgrade-plan" />
              <s-button type="submit">Upgrade plan</s-button>
            </form>
          ) : null}
          {dashboard.canDowngrade ? (
            <form method="post">
              <input type="hidden" name="intent" value="downgrade-plan" />
              <s-button type="submit">Downgrade plan</s-button>
            </form>
          ) : null}
          {dashboard.canCancel ? (
            <form method="post">
              <input type="hidden" name="intent" value="cancel-subscription" />
              <s-button tone="critical" type="submit">
                Cancel subscription
              </s-button>
            </form>
          ) : null}
        </s-stack>
      </s-section>
    </s-page>
  );
}
