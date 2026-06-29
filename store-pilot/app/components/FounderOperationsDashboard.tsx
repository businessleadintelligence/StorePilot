import type { FounderOperationsSnapshot } from "../types/store-dashboard";
import {
  getHealthIndicatorTone,
  getJobsHealthIndicator,
  getOnboardingHealthIndicator,
  getStartupHealthIndicator,
} from "../lib/display";

type FounderOperationsDashboardProps = {
  snapshot: FounderOperationsSnapshot;
};

type MetricCard = {
  label: string;
  value: number;
};

function MetricGrid({ items }: { items: MetricCard[] }) {
  return (
    <s-grid
      gridTemplateColumns="@container (inline-size > 700px) repeat(3, 1fr), 1fr"
      gap="base"
    >
      {items.map((item) => (
        <s-grid-item key={item.label}>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack gap="small-200">
              <s-text color="subdued">{item.label}</s-text>
              <s-heading>{item.value}</s-heading>
            </s-stack>
          </s-box>
        </s-grid-item>
      ))}
    </s-grid>
  );
}

export function FounderOperationsDashboard({
  snapshot,
}: FounderOperationsDashboardProps) {
  const jobsHealth = getJobsHealthIndicator(snapshot.jobs.failed);
  const onboardingHealth = getOnboardingHealthIndicator(
    snapshot.workers.stuckOnboarding,
  );
  const startupHealth = getStartupHealthIndicator(snapshot.startupReadiness);

  return (
    <s-page heading="Founder Operations Center">
      <s-section heading="Overview">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text type="strong">System health</s-text>
            <s-badge tone={getHealthIndicatorTone(startupHealth)}>
              Startup: {startupHealth}
            </s-badge>
            <s-badge tone={getHealthIndicatorTone(jobsHealth)}>
              Jobs: {jobsHealth}
            </s-badge>
            <s-badge tone={getHealthIndicatorTone(onboardingHealth)}>
              Onboarding: {onboardingHealth}
            </s-badge>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Stores">
        <MetricGrid
          items={[
            { label: "Total stores", value: snapshot.stores.totalStores },
            { label: "Active stores", value: snapshot.stores.activeStores },
            { label: "Inactive stores", value: snapshot.stores.inactiveStores },
          ]}
        />
      </s-section>

      <s-section heading="Onboarding">
        <MetricGrid
          items={[
            { label: "Completed", value: snapshot.onboarding.completed },
            { label: "Running", value: snapshot.onboarding.running },
            { label: "Failed", value: snapshot.onboarding.failed },
            { label: "Blocked", value: snapshot.onboarding.blocked },
            { label: "Not started", value: snapshot.onboarding.notStarted },
          ]}
        />
      </s-section>

      <s-section heading="Jobs">
        <MetricGrid
          items={[
            { label: "Queued", value: snapshot.jobs.queued },
            { label: "Running", value: snapshot.jobs.running },
            { label: "Completed", value: snapshot.jobs.completed },
            { label: "Failed", value: snapshot.jobs.failed },
            { label: "Dead letter", value: snapshot.jobs.deadLetter },
          ]}
        />
      </s-section>

      <s-section heading="Webhooks">
        <MetricGrid
          items={[
            { label: "Processed", value: snapshot.webhooks.processed },
            { label: "Pending", value: snapshot.webhooks.pending },
            { label: "Failed", value: snapshot.webhooks.failed },
          ]}
        />
      </s-section>

      <s-section heading="Workers">
        <MetricGrid
          items={[
            { label: "Stale jobs", value: snapshot.workers.staleJobs },
            { label: "Stuck onboarding", value: snapshot.workers.stuckOnboarding },
            { label: "Expired locks", value: snapshot.workers.expiredLocks },
          ]}
        />
      </s-section>
    </s-page>
  );
}
