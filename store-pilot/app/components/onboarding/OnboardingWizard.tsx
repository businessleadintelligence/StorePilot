import type { OnboardingDashboardData, OnboardingStepView } from "../../onboarding/onboarding-types";
import type { BillingPlanSummary } from "../../billing/billing-types";

type OnboardingWizardProps = {
  dashboard: OnboardingDashboardData;
};

function StepBadge({ step }: { step: OnboardingStepView }) {
  const tone =
    step.status === "completed" || step.status === "skipped"
      ? "success"
      : step.status === "blocked"
        ? "critical"
        : step.status === "in_progress"
          ? "warning"
          : undefined;

  return <s-badge tone={tone}>{step.status}</s-badge>;
}

function StepActions({ step }: { step: OnboardingStepView }) {
  return (
    <s-stack direction="inline" gap="base">
      {step.status !== "completed" && step.status !== "skipped" ? (
        <form method="post">
          <input type="hidden" name="intent" value="advance-step" />
          <input type="hidden" name="stepId" value={step.id} />
          <s-button type="submit">Continue</s-button>
        </form>
      ) : null}

      {step.skippable && step.status !== "completed" && step.status !== "skipped" ? (
        <form method="post">
          <input type="hidden" name="intent" value="skip-step" />
          <input type="hidden" name="stepId" value={step.id} />
          <s-button type="submit">Skip for now</s-button>
        </form>
      ) : null}

      {step.id === "google" ? (
        <form method="post">
          <input type="hidden" name="intent" value="begin-google-oauth" />
          <s-button type="submit">Connect Google</s-button>
        </form>
      ) : null}

      {step.id === "ga4" ? (
        <form method="post">
          <input type="hidden" name="intent" value="sync-ga4" />
          <s-button type="submit">Run first sync</s-button>
        </form>
      ) : null}

      {step.id === "search_console" ? (
        <form method="post">
          <input type="hidden" name="intent" value="sync-search-console" />
          <s-button type="submit">Run sync</s-button>
        </form>
      ) : null}

      {step.id === "pagespeed" ? (
        <form method="post">
          <input type="hidden" name="intent" value="sync-pagespeed" />
          <s-button type="submit">Run analysis</s-button>
        </form>
      ) : null}

      {step.id === "clarity" ? (
        <form method="post">
          <input type="hidden" name="intent" value="sync-clarity" />
          <s-button type="submit">Run sync</s-button>
        </form>
      ) : null}

      {step.id === "shopify_sync" ? (
        <form method="post">
          <input type="hidden" name="intent" value="retry-shopify-sync" />
          <s-button type="submit">Retry sync</s-button>
        </form>
      ) : null}

      {step.id === "ai_init" ? (
        <form method="post">
          <input type="hidden" name="intent" value="run-ai-init" />
          <s-button type="submit">Initialize AI</s-button>
        </form>
      ) : null}

      {step.id === "executive_briefing" ? (
        <form method="post">
          <input type="hidden" name="intent" value="complete-activation" />
          <s-button type="submit">Activate StorePilot</s-button>
        </form>
      ) : null}
    </s-stack>
  );
}

function WelcomeStepContent({ billingSummary }: { billingSummary: OnboardingDashboardData["billingSummary"] }) {
  return (
    <s-stack gap="base">
      <s-text type="strong">What StorePilot does</s-text>
      <s-paragraph>
        StorePilot monitors your Shopify store, connects external analytics, and turns
        operational data into prioritized recommendations with merchant approval before
        any automation runs.
      </s-paragraph>
      <s-text type="strong">How AI works</s-text>
      <s-paragraph>
        Specialist agents analyze synced store data deterministically. You review every
        recommendation before automation executes.
      </s-paragraph>
      <s-text type="strong">Privacy-by-Architecture</s-text>
      <s-paragraph>
        StorePilot never profiles customers, stores visitor IDs, or requires unnecessary
        permissions. GDPR compliance remains mandatory and scoped.
      </s-paragraph>
      <s-text type="strong">Plans and trial</s-text>
      <s-paragraph>{billingSummary.trialExplanation}</s-paragraph>
      <s-paragraph color="subdued">{billingSummary.upgradeMessage}</s-paragraph>
      <s-grid gridTemplateColumns="@container (inline-size > 700px) repeat(2, 1fr), 1fr" gap="base">
        {billingSummary.plans.map((plan: BillingPlanSummary) => (
          <s-grid-item key={plan.slug}>
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack gap="small-100">
                <s-text type="strong">{plan.name}</s-text>
                <s-text>${plan.priceUsd}/month</s-text>
                <s-text color="subdued">{plan.description}</s-text>
              </s-stack>
            </s-box>
          </s-grid-item>
        ))}
      </s-grid>
      <s-link href="/app/billing">View billing and plans</s-link>
      <form method="post">
        <input type="hidden" name="intent" value="complete-welcome" />
        <s-button type="submit">Start setup (3–5 minutes)</s-button>
      </form>
    </s-stack>
  );
}

function ExecutiveBriefingPanel({
  briefing,
}: {
  briefing: NonNullable<OnboardingDashboardData["executiveBriefing"]>;
}) {
  return (
    <s-stack gap="base">
      <s-text type="strong">{briefing.celebrationMessage}</s-text>
      <s-paragraph>{briefing.businessHealth}</s-paragraph>
      <s-text type="strong">Top priorities</s-text>
      {briefing.topPriorities.map((item) => (
        <s-text key={item} color="subdued">
          {item}
        </s-text>
      ))}
      <s-text type="strong">Quick wins</s-text>
      {briefing.quickWins.map((item) => (
        <s-text key={item} color="subdued">
          {item}
        </s-text>
      ))}
      <s-paragraph color="subdued">{briefing.expectedRevenueOpportunity}</s-paragraph>
      <s-stack direction="inline" gap="base">
        <s-badge tone={briefing.automationReady ? "success" : "warning"}>
          Automation {briefing.automationReady ? "ready" : "pending"}
        </s-badge>
        <s-badge tone={briefing.systemHealthLabel === "Healthy" ? "success" : "warning"}>
          System health: {briefing.systemHealthLabel}
        </s-badge>
      </s-stack>
    </s-stack>
  );
}

export function OnboardingWizard({ dashboard }: OnboardingWizardProps) {
  const currentStep =
    dashboard.steps.find((step) => step.id === dashboard.currentStepId) ?? dashboard.steps[0];

  return (
    <s-page heading="StorePilot Setup">
      <s-section heading="Progress">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-text type="strong">{dashboard.progress.completionPercent}% complete</s-text>
              <s-text color="subdued">
                {dashboard.progress.remainingSteps} steps remaining · ~
                {dashboard.progress.estimatedMinutesRemaining} min
              </s-text>
              <s-badge tone={dashboard.activationScore.score >= 80 ? "success" : "warning"}>
                Activation {dashboard.activationScore.score}
              </s-badge>
            </s-stack>
            <s-text color="subdued">{dashboard.progress.recommendedNextAction}</s-text>
            <s-text color="subdued">Stage: {dashboard.progress.lifecycleStage}</s-text>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Demo mode">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text>
              {dashboard.demoMode
                ? "Exploring StorePilot with sample data."
                : "Preview StorePilot before syncing your store."}
            </s-text>
            <form method="post">
              <input
                type="hidden"
                name="intent"
                value={dashboard.demoMode ? "exit-demo" : "enter-demo"}
              />
              <s-button type="submit">
                {dashboard.demoMode ? "Exit demo mode" : "Enter demo mode"}
              </s-button>
            </form>
          </s-stack>
          {dashboard.demoSnapshot ? (
            <s-text color="subdued">
              Demo snapshot: {dashboard.demoSnapshot.products} products ·{" "}
              {dashboard.demoSnapshot.orders} orders · score{" "}
              {dashboard.demoSnapshot.healthScore}
            </s-text>
          ) : null}
        </s-box>
      </s-section>

      <s-section heading={`Current step: ${currentStep?.label ?? "Setup"}`}>
        <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
          {currentStep ? (
            <s-stack gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text type="strong">{currentStep.label}</s-text>
                <StepBadge step={currentStep} />
              </s-stack>
              <s-paragraph color="subdued">{currentStep.description}</s-paragraph>
              {currentStep.summary ? <s-text>{currentStep.summary}</s-text> : null}
              {currentStep.warning ? (
                <s-text tone="critical">{currentStep.warning}</s-text>
              ) : null}
              {currentStep.id === "welcome" ? (
                <WelcomeStepContent billingSummary={dashboard.billingSummary} />
              ) : (
                <StepActions step={currentStep} />
              )}
              {currentStep.id === "executive_briefing" && dashboard.executiveBriefing ? (
                <ExecutiveBriefingPanel briefing={dashboard.executiveBriefing} />
              ) : null}
              {currentStep.id === "clarity" ? (
                <form method="post">
                  <input type="hidden" name="intent" value="connect-clarity" />
                  <s-text-field label="Project ID" name="projectId" required />
                  <s-text-field label="Project name" name="projectName" />
                  <s-text-field label="API token" name="apiToken" required />
                  <s-button type="submit">Test connection</s-button>
                </form>
              ) : null}
            </s-stack>
          ) : null}
        </s-box>
      </s-section>

      <s-section heading="All steps">
        <s-grid gridTemplateColumns="@container (inline-size > 700px) repeat(2, 1fr), 1fr" gap="base">
          {dashboard.steps.map((step) => (
            <s-grid-item key={step.id}>
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-text type="strong">{step.label}</s-text>
                    <StepBadge step={step} />
                  </s-stack>
                  {step.healthLabel ? (
                    <s-text color="subdued">{step.healthLabel}</s-text>
                  ) : null}
                  {step.summary ? <s-text color="subdued">{step.summary}</s-text> : null}
                </s-stack>
              </s-box>
            </s-grid-item>
          ))}
        </s-grid>
      </s-section>

      {dashboard.emptyStates.noProducts ||
      dashboard.emptyStates.noOrders ||
      dashboard.emptyStates.noConnectors ? (
        <s-section heading="Getting started guidance">
          <s-stack gap="small-200">
            {dashboard.emptyStates.noProducts ? (
              <s-text color="subdued">
                No products yet. Complete the Shopify sync step to import your catalog.
              </s-text>
            ) : null}
            {dashboard.emptyStates.noOrders ? (
              <s-text color="subdued">
                No orders yet. Order sync may require Shopify approval for protected customer data.
              </s-text>
            ) : null}
            {dashboard.emptyStates.noConnectors ? (
              <s-text color="subdued">
                Optional connectors are not connected. You can continue setup and connect them later
                in Settings.
              </s-text>
            ) : null}
          </s-stack>
        </s-section>
      ) : null}

      <s-section heading="Connector management">
        <s-paragraph color="subdued">
          Reconnect, disconnect, run sync, and test connections anytime from Settings.
        </s-paragraph>
        <s-link href="/app/settings">Open Settings</s-link>
      </s-section>
    </s-page>
  );
}
